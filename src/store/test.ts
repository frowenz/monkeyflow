import { create } from "zustand";
import { align, EMPTY_ALIGNMENT, tokenize, type Alignment, type Extra, type SpokenToken, type WordStatus } from "../lib/align";
import {
  accuracy,
  consistency,
  correctWpmChars,
  countChars,
  errorCount,
  rawChars,
  smooth,
  wpmFromChars,
  type CharCounts,
} from "../lib/stats";
import { wordsMatch } from "../lib/normalize";
import { randomQuote, splitText, WordGenerator, type Quote } from "../lib/words";
import { getConfig, type Engine, type Mode } from "./config";

export type TestStatus = "idle" | "active" | "finished";

export interface HistoryWord {
  target: string;
  status: WordStatus | "untouched";
  input: string;
}

export interface TestResult {
  wpm: number;
  raw: number;
  acc: number;
  consistency: number;
  time: number;
  chars: CharCounts;
  mode: Mode;
  mode2: string;
  punctuation: boolean;
  numbers: boolean;
  language: string;
  engine: Engine;
  chart: { wpm: number[]; raw: number[]; err: number[]; labels: number[] };
  words: HistoryWord[];
  extras: Extra[];
  quote: Quote | null;
  isPb: boolean;
  previousPb: number | null;
  invalid: string | null;
  timestamp: number;
}

interface Snapshot {
  correct: number;
  raw: number;
  errors: number;
}

interface TestState {
  status: TestStatus;
  testId: number;
  targets: string[];
  quote: Quote | null;
  inputText: string;
  interimText: string;
  tokens: SpokenToken[];
  alignment: Alignment;
  startTime: number | null;
  elapsed: number;
  snapshots: Snapshot[];
  result: TestResult | null;
  /** Earliest plausible start of speech (voice activity onset), used to backdate the clock. */
  pendingStartAt: number | null;
  lastVoiceAt: number;

  newTest: (opts?: { repeat?: boolean }) => void;
  setInput: (text: string) => void;
  commitSpeech: (text: string) => void;
  setInterim: (text: string) => void;
  noteVoiceStart: (at: number) => void;
  noteVoiceActivity: (at: number) => void;
  finish: (at?: number) => void;
}

let generator: WordGenerator | null = null;
let timer: number | null = null;

function modeTwo(): string {
  const c = getConfig();
  switch (c.mode) {
    case "time":
      return String(c.time);
    case "words":
      return String(c.words);
    case "quote":
      return c.quoteLength;
    case "zen":
      return "zen";
    default:
      return "custom";
  }
}

function buildTargets(prevQuote: Quote | null): { targets: string[]; quote: Quote | null } {
  const c = getConfig();
  generator = new WordGenerator({ language: c.language, punctuation: c.punctuation, numbers: c.numbers });
  switch (c.mode) {
    case "time":
      return { targets: generator.take(80), quote: null };
    case "words":
      return { targets: generator.take(c.words), quote: null };
    case "quote": {
      const quote = randomQuote(c.quoteLength, prevQuote?.id);
      return { targets: splitText(quote.text), quote };
    }
    case "custom":
      return { targets: splitText(c.customText || "the quick brown fox"), quote: null };
    case "zen":
      return { targets: [], quote: null };
  }
}

function pbKey(r: Pick<TestResult, "mode" | "mode2" | "language" | "punctuation" | "numbers" | "engine">) {
  return `${r.mode}|${r.mode2}|${r.language}|${r.punctuation ? 1 : 0}|${r.numbers ? 1 : 0}|${r.engine}`;
}

function loadPbs(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("monkeyflow-pbs") || "{}");
  } catch {
    return {};
  }
}

export function savedResults(): TestResult[] {
  try {
    return JSON.parse(localStorage.getItem("monkeyflow-results") || "[]");
  } catch {
    return [];
  }
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export const useTest = create<TestState>((set, get) => {
  const recompute = (inputText: string, interimText: string) => {
    const c = getConfig();
    const state = get();
    if (state.status === "finished") return;

    const committed = tokenize(inputText, {
      strictness: c.strictness,
      allowInProgress: interimText.trim().length === 0,
    });
    const interim = tokenize(interimText, { strictness: c.strictness, interim: true });
    const tokens = [...committed, ...interim];

    let targets = state.targets;
    let alignment: Alignment;
    if (c.mode === "zen") {
      targets = tokens.map((t) => t.text);
      alignment = {
        ...EMPTY_ALIGNMENT,
        words: tokens.map((t) => ({
          status: t.inProgress ? "partial" : "correct",
          input: t.text,
          interim: !!t.interim,
        })),
        caretWord: tokens.length && tokens[tokens.length - 1].inProgress ? tokens.length - 1 : tokens.length,
        caretLetter: tokens.length && tokens[tokens.length - 1].inProgress ? tokens[tokens.length - 1].text.length : 0,
        correctWords: tokens.length,
      };
    } else {
      alignment = align(targets, tokens, c.strictness);
      if (c.mode === "time" && generator && targets.length - alignment.caretWord < 50) {
        targets = [...targets, ...generator.take(60)];
      }
    }

    set({ inputText, interimText, tokens, alignment, targets });

    const now = performance.now();
    if (state.status === "idle" && tokens.length > 0) {
      const pending = state.pendingStartAt;
      const startAt = pending !== null && now - pending < 2500 ? pending : now;
      startTest(startAt);
    }

    if (get().status === "active" && (c.mode === "words" || c.mode === "quote" || c.mode === "custom")) {
      const n = targets.length;
      const last = alignment.words[n - 1];
      if (n > 0 && last && alignment.caretWord >= n - 1) {
        const done =
          (alignment.caretWord >= n && (last.status === "correct" || !last.interim)) ||
          (last.status === "partial" && wordsMatch(targets[n - 1], last.input, c.strictness));
        if (done) {
          let endAt = now;
          if (c.engine === "flow" && state.lastVoiceAt > 0 && now - state.lastVoiceAt < 5000) {
            endAt = Math.min(now, state.lastVoiceAt + 150);
          }
          get().finish(endAt);
        }
      }
    }
  };

  const snapshot = (): Snapshot => {
    const s = get();
    return {
      correct: correctWpmChars(s.targets, s.alignment),
      raw: rawChars(s.tokens),
      errors: errorCount(s.alignment),
    };
  };

  const startTest = (startAt: number) => {
    stopTimer();
    set({ status: "active", startTime: startAt, elapsed: (performance.now() - startAt) / 1000, snapshots: [] });
    timer = window.setInterval(() => {
      const s = get();
      if (s.status !== "active" || s.startTime === null) return;
      const elapsed = (performance.now() - s.startTime) / 1000;
      const whole = Math.floor(elapsed);
      if (whole > s.snapshots.length) {
        const snaps = [...s.snapshots];
        while (snaps.length < whole) snaps.push(snapshot());
        set({ snapshots: snaps });
      }
      set({ elapsed });
      const c = getConfig();
      if (c.mode === "time" && elapsed >= c.time) {
        get().finish(s.startTime + c.time * 1000);
      }
    }, 50);
  };

  return {
    status: "idle",
    testId: 0,
    targets: [],
    quote: null,
    inputText: "",
    interimText: "",
    tokens: [],
    alignment: EMPTY_ALIGNMENT,
    startTime: null,
    elapsed: 0,
    snapshots: [],
    result: null,
    pendingStartAt: null,
    lastVoiceAt: 0,

    newTest: (opts) => {
      stopTimer();
      const prev = get();
      let targets: string[];
      let quote: Quote | null;
      if (opts?.repeat && prev.targets.length && getConfig().mode !== "time" && getConfig().mode !== "zen") {
        targets = prev.result ? prev.result.words.map((w) => w.target) : prev.targets;
        quote = prev.quote;
      } else {
        ({ targets, quote } = buildTargets(prev.quote));
      }
      set({
        status: "idle",
        testId: prev.testId + 1,
        targets,
        quote,
        inputText: "",
        interimText: "",
        tokens: [],
        alignment: EMPTY_ALIGNMENT,
        startTime: null,
        elapsed: 0,
        snapshots: [],
        result: null,
        pendingStartAt: null,
        lastVoiceAt: 0,
      });
    },

    setInput: (text) => recompute(text, get().interimText),

    commitSpeech: (text) => {
      const s = get();
      if (s.status === "finished") return;
      const base = s.inputText;
      const sep = base.length === 0 || /\s$/.test(base) ? "" : " ";
      recompute(`${base}${sep}${text.trim()} `, "");
    },

    setInterim: (text) => {
      const s = get();
      if (s.status === "finished" || text === s.interimText) return;
      recompute(s.inputText, text);
    },

    noteVoiceStart: (at) => {
      const s = get();
      if (s.status !== "idle") return;
      set({ pendingStartAt: at, lastVoiceAt: at });
      if (getConfig().engine === "flow") startTest(at);
    },

    noteVoiceActivity: (at) => set({ lastVoiceAt: at }),

    finish: (at) => {
      const s = get();
      if (s.status !== "active" || s.startTime === null) return;
      stopTimer();
      const c = getConfig();
      const endAt = at ?? performance.now();
      const time = Math.max(0.001, (endAt - s.startTime) / 1000);

      const snaps = [...s.snapshots];
      const wholeSeconds = Math.floor(time + 1e-6);
      while (snaps.length < wholeSeconds) snaps.push(snapshot());
      const labels: number[] = snaps.map((_, i) => i + 1);
      const finalSnap = snapshot();
      const frac = time - wholeSeconds;
      if (frac > 0.2 || snaps.length === 0) {
        snaps.push(finalSnap);
        labels.push(Math.round(time * 100) / 100);
      } else if (snaps.length) {
        snaps[snaps.length - 1] = finalSnap;
      }

      const wpmLine = snaps.map((sn, i) => wpmFromChars(sn.correct, labels[i]));
      const rawPerSecond = snaps.map((sn, i) => {
        const prev = i === 0 ? 0 : snaps[i - 1].raw;
        const prevT = i === 0 ? 0 : labels[i - 1];
        return wpmFromChars(sn.raw - prev, Math.max(0.2, labels[i] - prevT));
      });
      const rawLine = smooth(rawPerSecond, 3);
      const errLine = snaps.map((sn, i) => Math.max(0, sn.errors - (i === 0 ? 0 : snaps[i - 1].errors)));

      const chars = countChars(s.targets, s.alignment);
      const wpm = wpmFromChars(finalSnap.correct, time);
      const raw = wpmFromChars(finalSnap.raw, time);
      const acc = accuracy(chars);
      const cons = consistency(rawLine);

      const historyCount =
        c.mode === "time" ? Math.max(s.alignment.words.length, s.alignment.caretWord) : s.targets.length;
      const words: HistoryWord[] = s.targets.slice(0, historyCount).map((target, i) => {
        const w = s.alignment.words[i];
        return { target, status: w ? w.status : "untouched", input: w ? w.input : "" };
      });

      let invalid: string | null = null;
      if (time < 1.5 && c.mode !== "time") invalid = "test too short";
      else if (s.tokens.length === 0) invalid = "afk detected";

      const base = {
        mode: c.mode,
        mode2: modeTwo(),
        language: c.language.replace("_", " "),
        punctuation: c.punctuation,
        numbers: c.numbers,
        engine: c.engine,
      };
      const pbs = loadPbs();
      const key = pbKey(base);
      const previousPb = pbs[key] ?? null;
      const isPb = !invalid && wpm > 0 && (previousPb === null || wpm > previousPb);
      if (isPb) {
        pbs[key] = wpm;
        localStorage.setItem("monkeyflow-pbs", JSON.stringify(pbs));
      }

      const result: TestResult = {
        ...base,
        wpm,
        raw,
        acc,
        consistency: cons,
        time,
        chars,
        chart: { wpm: wpmLine, raw: rawLine, err: errLine, labels },
        words,
        extras: s.alignment.extras,
        quote: s.quote,
        isPb,
        previousPb,
        invalid,
        timestamp: Date.now(),
      };

      if (!invalid) {
        const all = savedResults();
        all.unshift(result);
        localStorage.setItem("monkeyflow-results", JSON.stringify(all.slice(0, 50).map((r) => ({ ...r, words: [], chart: { wpm: [], raw: [], err: [], labels: [] } }))));
      }

      set({ status: "finished", elapsed: time, snapshots: snaps, result });
    },
  };
});

export function currentWpm(): number {
  const s = useTest.getState();
  if (s.status !== "active" || s.startTime === null) return 0;
  const elapsed = (performance.now() - s.startTime) / 1000;
  if (elapsed < 0.5) return 0;
  return wpmFromChars(correctWpmChars(s.targets, s.alignment), elapsed);
}

export function currentAcc(): number {
  const s = useTest.getState();
  return accuracy(countChars(s.targets, s.alignment));
}
