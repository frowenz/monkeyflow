import {
  isFiller,
  normalizeWord,
  normalizedEqual,
  similarity,
  wordsToNumber,
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
  const parts = text.split(/\s+/).filter((p) => p.length > 0);
  const endsWithSpace = /\s$/.test(text);
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

const MATCH = 3;
const PARTIAL_PREFIX = 1;
const SUB_SIMILAR = 0.5;
const SUB = -1;
const INS = -1;
const INS_FILLER = -0.15;
const DEL = -1.5;
const MERGE2 = 2.8;
const MERGE3 = 2.6;
const SPLIT2 = MATCH * 2 - 0.3;

const OP_NONE = 0;
const OP_MATCH = 1;
const OP_SUB = 2;
const OP_INS = 3;
const OP_DEL = 4;
const OP_MERGE2 = 5;
const OP_MERGE3 = 6;
const OP_SPLIT2 = 7;
const OP_PARTIAL = 8;

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
  const tnorm = targets
    .slice(0, n)
    .map((t) => (strictness === "strict" ? t : normalizeWord(t)));

  const tnum = tnorm.map((t) => wordsToNumber([t]));

  const eq = (target: string, tok: SpokenToken) =>
    strictness === "strict" ? target === tok.norm : normalizedEqual(target, tok.norm);

  const phrase = (k: number, i: number) => {
    if (i < k) return null;
    const norms = tokens.slice(i - k, i).map((t) => t.norm);
    return { joined: norms.join(""), num: wordsToNumber(norms) };
  };
  const phraseHits = (p: { joined: string; num: string | null } | null, j: number) =>
    p !== null && (p.joined === tnorm[j] || (p.num !== null && p.num === tnum[j]));

  const dp = new Float64Array((m + 1) * W).fill(-Infinity);
  const op = new Uint8Array((m + 1) * W);

  dp[0] = 0;
  for (let j = 1; j <= n; j++) {
    dp[j] = dp[j - 1] + DEL;
    op[j] = OP_DEL;
  }

  for (let i = 1; i <= m; i++) {
    const tok = tokens[i - 1];
    const row = i * W;
    const prevRow = (i - 1) * W;
    const filler = !tok.inProgress && strictness !== "strict" && isFiller(tok.norm);
    const canMerge = !tok.inProgress && strictness !== "strict";
    const p2 = canMerge ? phrase(2, i) : null;
    const p3 = canMerge ? phrase(3, i) : null;
    for (let j = 0; j <= n; j++) {
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
        const c = dp[row + j - 1] + DEL;
        if (c > best) {
          best = c;
          bestOp = OP_DEL;
        }

        const t = tnorm[j - 1];
        const diag = dp[prevRow + j - 1];
        if (eq(t, tok)) {
          const c2 = diag + MATCH;
          if (c2 >= best) {
            best = c2;
            bestOp = OP_MATCH;
          }
        } else if (tok.inProgress) {
          // Worth less than a skipped word, so half-typed words never jump ahead.
          const c2 = diag + (t.startsWith(tok.norm) ? PARTIAL_PREFIX : 0);
          if (c2 >= best) {
            best = c2;
            bestOp = OP_PARTIAL;
          }
        } else {
          const s = similarity(t, tok.norm) >= 0.5 ? SUB_SIMILAR : SUB;
          const c2 = diag + s;
          if (c2 > best) {
            best = c2;
            bestOp = OP_SUB;
          }
        }

        if (canMerge) {
          if (phraseHits(p2, j - 1)) {
            const c3 = dp[(i - 2) * W + j - 1] + MERGE2;
            if (c3 > best) {
              best = c3;
              bestOp = OP_MERGE2;
            }
          }
          if (phraseHits(p3, j - 1)) {
            const c3 = dp[(i - 3) * W + j - 1] + MERGE3;
            if (c3 > best) {
              best = c3;
              bestOp = OP_MERGE3;
            }
          }
          if (j >= 2 && tnorm[j - 2] + t === tok.norm) {
            const c3 = dp[prevRow + j - 2] + SPLIT2;
            if (c3 > best) {
              best = c3;
              bestOp = OP_SPLIT2;
            }
          }
        }
      }

      dp[row + j] = best;
      op[row + j] = bestOp;
    }
  }

  let bestJ = 0;
  let bestScore = -Infinity;
  const lastRow = m * W;
  for (let j = 0; j <= n; j++) {
    if (dp[lastRow + j] > bestScore) {
      bestScore = dp[lastRow + j];
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
    } else if (o === OP_SPLIT2) {
      const tok = tokens[i - 1];
      words[j - 1] = { status: "correct", input: tok.text, interim: !!tok.interim };
      words[j - 2] = { status: "correct", input: tok.text, interim: !!tok.interim };
      i--;
      j -= 2;
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
