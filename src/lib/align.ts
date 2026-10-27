import {
  isFiller,
  isSimilar,
  looseKeys,
  normalizeWord,
  phraseKeys,
  soundsLikeJoin,
  wordKeys,
  type MatchStrictness,
} from "./normalize";

export interface SpokenToken {
  text: string;
  norm: string;
  /** Last keyboard-typed word that has no trailing space yet. */
  inProgress?: boolean;
  /** Came from a not-yet-final speech recognition hypothesis. */
  interim?: boolean;
}

export type WordStatus = "correct" | "incorrect" | "missed" | "partial";

export interface WordResult {
  status: WordStatus;
  input: string;
  interim: boolean;
}

export interface Extra {
  afterTarget: number;
  text: string;
}

export interface Alignment {
  words: WordResult[];
  caretWord: number;
  caretLetter: number;
  extras: Extra[];
  correctWords: number;
  incorrectWords: number;
  missedWords: number;
  extraWords: number;
}

export const EMPTY_ALIGNMENT: Alignment = {
  words: [],
  caretWord: 0,
  caretLetter: 0,
  extras: [],
  correctWords: 0,
  incorrectWords: 0,
  missedWords: 0,
  extraWords: 0,
};

export function tokenize(
  text: string,
  opts: { interim?: boolean; allowInProgress?: boolean; strictness: MatchStrictness },
): SpokenToken[] {
  const raw = text.split(/\s+/).filter((p) => p.length > 0);
  const endsWithSpace = /\s$/.test(text);
  const parts: string[] = [];
  for (const part of raw) {
    // Chrome formats runs of spoken numbers like phone numbers ("35-1455"); keep the groups apart.
    if (opts.strictness !== "strict" && /^[$\d][\d,.]*(-[\d,.]*\d)+[%.,]?$/.test(part)) parts.push(...part.split("-"));
    else parts.push(part);
  }
  const tokens: SpokenToken[] = [];
  parts.forEach((part, idx) => {
    const norm = opts.strictness === "strict" ? part : normalizeWord(part);
    if (norm.length === 0) return;
    tokens.push({
      text: part,
      norm,
      interim: opts.interim,
      inProgress: opts.allowInProgress && idx === parts.length - 1 && !endsWithSpace,
    });
  });
  return tokens;
}

const BAND = 32;
const MATCH = 3;
const MATCH_LOOSE = 2.6;
const PARTIAL_PREFIX = 1;
// Sequential like monkeytype: a wrong word takes the next slot (SUB is free) and
// skipping or ignoring words only pays off after two confirming matches.
const SUB_SIMILAR = 0.3;
const SUB = 0;
const INS = -3.5;
const INS_FILLER = 0;
const DEL = -3.5;
const MERGE2 = 2.8;
const MERGE3 = 2.6;
const SPLIT2 = MATCH * 2 - 0.3;
const SPLIT3 = MATCH * 3 - 0.6;
const FUZZY_SPLIT2 = MATCH * 2 - 1.6;

const OP_NONE = 0;
const OP_MATCH = 1;
const OP_SUB = 2;
const OP_INS = 3;
const OP_DEL = 4;
const OP_MERGE2 = 5;
const OP_MERGE3 = 6;
const OP_SPLIT2 = 7;
const OP_PARTIAL = 8;
const OP_SKIP = 9;
const OP_SPLIT3 = 10;
const OP_FUZZY_SPLIT2 = 11;

function buildIndex(keysPerTarget: readonly (readonly string[])[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  keysPerTarget.forEach((keys, j) => {
    for (const k of keys) {
      const list = index.get(k);
      if (list) list.push(j);
      else index.set(k, [j]);
    }
  });
  return index;
}

function stampAll(index: Map<string, number[]>, keys: readonly string[], stamp: Int32Array, value: number) {
  for (const k of keys) {
    const list = index.get(k);
    if (list) for (const j of list) stamp[j] = value;
  }
}

/**
 * Globally aligns what was said against the target words (free end on the
 * target side), so dropped, extra, merged or split words don't derail
 * everything that follows.
 */
export function align(
  targets: string[],
  tokens: SpokenToken[],
  strictness: MatchStrictness,
): Alignment {
  const m = tokens.length;
  if (m === 0) return EMPTY_ALIGNMENT;
  const n = Math.min(targets.length, 2 * m + 20);
  const W = n + 1;
  const strict = strictness === "strict";
  const tnorm = targets.slice(0, n).map((t) => (strict ? t : normalizeWord(t)));
  const tkeys = targets.slice(0, n).map((t) => (strict ? [`=${t}`] : wordKeys(t)));
  // Punctuation-only targets ("-") can't be spoken, so they're skipped for free.
  const unspeakable = tnorm.map((t, j) => !strict && t.length === 0 && targets[j].trim().length > 0);

  const matchIndex = buildIndex(tkeys);
  const looseIndex = strict ? null : buildIndex(tnorm.map((t) => looseKeys(t)));
  const pairIndex = strict
    ? null
    : buildIndex(tnorm.map((t, j) => (j >= 1 && t && tnorm[j - 1] ? phraseKeys([tnorm[j - 1], t]) : [])));
  const tripleIndex = strict
    ? null
    : buildIndex(tnorm.map((t, j) => (j >= 2 && t && tnorm[j - 1] && tnorm[j - 2] ? phraseKeys([tnorm[j - 2], tnorm[j - 1], t]) : [])));

  const matchStamp = new Int32Array(n).fill(-1);
  const looseStamp = new Int32Array(n).fill(-1);
  const merge2Stamp = new Int32Array(n).fill(-1);
  const merge3Stamp = new Int32Array(n).fill(-1);
  const split2Stamp = new Int32Array(n).fill(-1);
  const split3Stamp = new Int32Array(n).fill(-1);

  const dp = new Float64Array((m + 1) * W).fill(-Infinity);
  const op = new Uint8Array((m + 1) * W);

  dp[0] = 0;
  for (let j = 1; j <= n; j++) {
    if (unspeakable[j - 1]) {
      dp[j] = dp[j - 1];
      op[j] = OP_SKIP;
    } else {
      dp[j] = dp[j - 1] + DEL;
      op[j] = OP_DEL;
    }
  }

  // Only search a band around where the speaker is (the previous row's best column): with
  // sequential scoring the path never strays far from it, and this keeps long tests O(m).
  let center = 0;
  for (let i = 1; i <= m; i++) {
    const tok = tokens[i - 1];
    const row = i * W;
    const prevRow = (i - 1) * W;
    const filler = !tok.inProgress && !strict && isFiller(tok.norm);
    const canMerge = !tok.inProgress && !strict;
    const tokKeys = strict ? [`=${tok.norm}`] : wordKeys(tok.text);
    const fuzzyJoin = canMerge && tok.norm.length >= 6 && /^[a-z]+$/.test(tok.norm);
    const head = tok.norm[0];

    stampAll(matchIndex, tokKeys, matchStamp, i);
    if (canMerge) {
      stampAll(looseIndex!, looseKeys(tok.norm), looseStamp, i);
      if (i >= 2) stampAll(matchIndex, phraseKeys([tokens[i - 2].norm, tok.norm]), merge2Stamp, i);
      if (i >= 3) stampAll(matchIndex, phraseKeys([tokens[i - 3].norm, tokens[i - 2].norm, tok.norm]), merge3Stamp, i);
      stampAll(pairIndex!, tokKeys, split2Stamp, i);
      stampAll(tripleIndex!, tokKeys, split3Stamp, i);
    }

    const jLo = Math.max(0, center - BAND);
    const jHi = Math.min(n, center + BAND + 3);
    let rowBest = -Infinity;
    let rowBestJ = jLo;
    for (let j = jLo; j <= jHi; j++) {
      let best = -Infinity;
      let bestOp = OP_NONE;

      if (!tok.inProgress) {
        const c = dp[prevRow + j] + (filler ? INS_FILLER : INS);
        if (c > best) {
          best = c;
          bestOp = OP_INS;
        }
      }

      if (j > 0) {
        const t = j - 1;
        if (unspeakable[t]) {
          const c = dp[row + j - 1];
          if (c >= best) {
            best = c;
            bestOp = OP_SKIP;
          }
        } else {
          const c = dp[row + j - 1] + DEL;
          if (c > best) {
            best = c;
            bestOp = OP_DEL;
          }
        }

        const diag = dp[prevRow + j - 1];
        if (matchStamp[t] === i) {
          const c2 = diag + MATCH;
          if (c2 >= best) {
            best = c2;
            bestOp = OP_MATCH;
          }
        } else if (tok.inProgress) {
          // Worth less than a skipped word, so half-typed words never jump ahead.
          const c2 = diag + (tnorm[t].startsWith(tok.norm) ? PARTIAL_PREFIX : 0);
          if (c2 >= best) {
            best = c2;
            bestOp = OP_PARTIAL;
          }
        } else if (canMerge && looseStamp[t] === i) {
          // a dropped/added -s or -ed is a real mistake, but it still anchors the alignment
          const c2 = diag + MATCH_LOOSE;
          if (c2 > best) {
            best = c2;
            bestOp = OP_SUB;
          }
        } else if (!unspeakable[t] && !filler) {
          const c2 = diag + (isSimilar(tnorm[t], tok.norm) ? SUB_SIMILAR : SUB);
          if (c2 > best) {
            best = c2;
            bestOp = OP_SUB;
          }
        }

        if (canMerge) {
          if (merge2Stamp[t] === i) {
            const c3 = dp[(i - 2) * W + j - 1] + MERGE2;
            if (c3 > best) {
              best = c3;
              bestOp = OP_MERGE2;
            }
          }
          if (merge3Stamp[t] === i) {
            const c3 = dp[(i - 3) * W + j - 1] + MERGE3;
            if (c3 > best) {
              best = c3;
              bestOp = OP_MERGE3;
            }
          }
          if (split2Stamp[t] === i) {
            const c3 = dp[prevRow + j - 2] + SPLIT2;
            if (c3 > best) {
              best = c3;
              bestOp = OP_SPLIT2;
            }
          }
          if (split3Stamp[t] === i) {
            const c3 = dp[prevRow + j - 3] + SPLIT3;
            if (c3 > best) {
              best = c3;
              bestOp = OP_SPLIT3;
            }
          }
          if (fuzzyJoin && j >= 2 && tnorm[t - 1].startsWith(head) && dp[prevRow + j - 2] + FUZZY_SPLIT2 > best) {
            if (soundsLikeJoin(tok.norm, tnorm[t - 1], tnorm[t])) {
              best = dp[prevRow + j - 2] + FUZZY_SPLIT2;
              bestOp = OP_FUZZY_SPLIT2;
            }
          }
        }
      }

      dp[row + j] = best;
      op[row + j] = bestOp;
      if (best > rowBest) {
        rowBest = best;
        rowBestJ = j;
      }
    }
    center = rowBestJ;
  }

  // Ties at the free end come from a trailing unmatched token (an extra vs. a wrong guess at the
  // next word) or a skippable target. Once the token is final, treat it as the attempt at the
  // next word so the caret moves on and the last word of a test can complete.
  const lastTok = tokens[m - 1];
  const preferAdvance = !lastTok.interim && !lastTok.inProgress;
  let bestJ = 0;
  let bestScore = -Infinity;
  const lastRow = m * W;
  for (let j = 0; j <= n; j++) {
    const s = dp[lastRow + j];
    if (s > bestScore || (s === bestScore && (preferAdvance || (j > 0 && unspeakable[j - 1])))) {
      bestScore = s;
      bestJ = j;
    }
  }

  const words: WordResult[] = new Array(bestJ);
  const extras: Extra[] = [];
  let caretLetter = 0;
  let caretWord = bestJ;
  let i = m;
  let j = bestJ;
  while (i > 0 || j > 0) {
    const o = op[i * W + j];
    if (o === OP_MATCH || o === OP_SUB || o === OP_PARTIAL) {
      const tok = tokens[i - 1];
      if (tok.inProgress) {
        words[j - 1] = {
          status: o === OP_MATCH ? "correct" : "partial",
          input: tok.text,
          interim: !!tok.interim,
        };
        if (j === bestJ) {
          caretWord = j - 1;
          caretLetter = o === OP_MATCH ? targets[j - 1].length : tok.text.length;
        }
      } else {
        words[j - 1] = {
          status: o === OP_MATCH ? "correct" : "incorrect",
          input: tok.text,
          interim: !!tok.interim,
        };
      }
      i--;
      j--;
    } else if (o === OP_INS) {
      extras.push({ afterTarget: j, text: tokens[i - 1].text });
      i--;
    } else if (o === OP_DEL) {
      words[j - 1] = { status: "missed", input: "", interim: false };
      j--;
    } else if (o === OP_SKIP) {
      words[j - 1] = { status: "correct", input: "", interim: false };
      j--;
    } else if (o === OP_MERGE2 || o === OP_MERGE3) {
      const k = o === OP_MERGE2 ? 2 : 3;
      const toks = tokens.slice(i - k, i);
      words[j - 1] = {
        status: "correct",
        input: toks.map((t) => t.text).join(" "),
        interim: toks.some((t) => t.interim),
      };
      i -= k;
      j--;
    } else if (o === OP_SPLIT2 || o === OP_SPLIT3 || o === OP_FUZZY_SPLIT2) {
      const k = o === OP_SPLIT3 ? 3 : 2;
      const tok = tokens[i - 1];
      for (let q = 1; q <= k; q++) words[j - q] = { status: "correct", input: tok.text, interim: !!tok.interim };
      i--;
      j -= k;
    } else {
      break;
    }
  }
  extras.reverse();

  let correctWords = 0;
  let incorrectWords = 0;
  let missedWords = 0;
  for (const w of words) {
    if (w.status === "correct") correctWords++;
    else if (w.status === "incorrect") incorrectWords++;
    else if (w.status === "missed") missedWords++;
  }

  return {
    words,
    caretWord,
    caretLetter,
    extras,
    correctWords,
    incorrectWords,
    missedWords,
    extraWords: extras.filter((e) => !isFiller(normalizeWord(e.text))).length,
  };
}
