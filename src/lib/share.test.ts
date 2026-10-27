import { beforeAll, describe, expect, it, vi } from "vitest";
import { useConfig } from "../store/config";
import { useTest, type TestResult } from "../store/test";
import {
  challengeConfig,
  challengeFromResult,
  challengeMatchesResult,
  challengeMatchesTest,
  challengeOutcome,
  challengeUrl,
  compareToTyping,
  formatMultiplier,
  parseChallenge,
  shareText,
  type Challenge,
} from "./share";
import { mulberry32, QUOTES, WordGenerator } from "./words";

const ORIGIN = "https://monkeyflow.test";
const parse = (url: string) => parseChallenge(new URL(url).searchParams);

function result(overrides: Partial<TestResult>): TestResult {
  return {
    wpm: 214.4,
    raw: 220,
    acc: 98.6,
    consistency: 80,
    time: 30,
    chars: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
    mode: "time",
    mode2: "30",
    punctuation: false,
    numbers: false,
    language: "english",
    engine: "builtin",
    chart: { wpm: [], raw: [], burst: [], err: [], labels: [] },
    words: [],
    extras: [],
    quote: null,
    seed: 12345,
    isPb: false,
    previousPb: null,
    invalid: null,
    timestamp: 0,
    ...overrides,
  };
}

beforeAll(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("challenge links", () => {
  it("encodes seeded tests with only non-default flags", () => {
    const c = challengeFromResult(result({}))!;
    expect(challengeUrl(c, ORIGIN)).toBe(`${ORIGIN}/?m=time&n=30&s=12345&w=214&a=98`);

    const flagged = challengeFromResult(
      result({ mode: "words", mode2: "10", punctuation: true, numbers: true, language: "english 1k", seed: 7 }),
    )!;
    expect(challengeUrl(flagged, ORIGIN)).toBe(`${ORIGIN}/?m=words&n=10&s=7&p=1&d=1&l=english_1k&w=214&a=98`);
  });

  it("round-trips seeded and quote challenges", () => {
    const seeded: Challenge = {
      kind: "seed",
      mode: "words",
      n: 50,
      seed: 4294967295,
      punctuation: true,
      numbers: false,
      language: "english_1k",
      wpm: 180,
      acc: 97,
    };
    expect(parse(challengeUrl(seeded, ORIGIN))).toEqual(seeded);

    const quote: Challenge = { kind: "quote", quoteId: QUOTES[3].id, wpm: 150, acc: null };
    expect(challengeUrl(quote, ORIGIN)).toBe(`${ORIGIN}/?q=${QUOTES[3].id}&w=150`);
    expect(parse(challengeUrl(quote, ORIGIN))).toEqual(quote);
  });

  it("parses the documented example and defaults missing flags", () => {
    expect(parse(`${ORIGIN}/?m=time&n=15&s=12345&w=180&a=97`)).toEqual({
      kind: "seed",
      mode: "time",
      n: 15,
      seed: 12345,
      punctuation: false,
      numbers: false,
      language: "english",
      wpm: 180,
      acc: 97,
    });
  });

  it("rejects links it can't reproduce", () => {
    expect(parse(`${ORIGIN}/?m=zen&n=15&s=1`)).toBeNull();
    expect(parse(`${ORIGIN}/?m=time&n=15&s=-1`)).toBeNull();
    expect(parse(`${ORIGIN}/?m=time&n=15&s=1&l=klingon`)).toBeNull();
    expect(parse(`${ORIGIN}/?q=999999999`)).toBeNull();
    expect(parse(`${ORIGIN}/?m=time&n=15&s=1&w=lots`)).toMatchObject({ wpm: null });
  });

  it("drops the score from invalid results and skips unreplayable modes", () => {
    expect(challengeFromResult(result({ invalid: "afk detected" }))).toMatchObject({ wpm: null, acc: null });
    expect(challengeFromResult(result({ mode: "custom", mode2: "custom" }))).toBeNull();
    expect(challengeUrl(null, ORIGIN)).toBe(`${ORIGIN}/`);
  });

  it("matches results and tests of the same challenge only", () => {
    const c = challengeFromResult(result({ language: "english 1k" }))!;
    expect(challengeMatchesResult(c, result({ language: "english 1k" }))).toBe(true);
    expect(challengeMatchesResult(c, result({ language: "english 1k", seed: 1 }))).toBe(false);
    expect(challengeMatchesResult(c, result({ language: "english" }))).toBe(false);

    const config = { mode: "time", time: 30, words: 25, punctuation: false, numbers: false, language: "english_1k" } as const;
    expect(challengeMatchesTest(c, { seed: 12345, quote: null }, config)).toBe(true);
    expect(challengeMatchesTest(c, { seed: 12345, quote: null }, { ...config, time: 60 })).toBe(false);
  });

  it("compares the score", () => {
    expect(challengeOutcome(180, result({ wpm: 190 }))).toBe("beat");
    expect(challengeOutcome(180, result({ wpm: 180.2 }))).toBe("tied");
    expect(challengeOutcome(180, result({ wpm: 150 }))).toBe("short");
    expect(challengeOutcome(180, result({ wpm: 250, invalid: "test too short" }))).toBe("short");
  });
});

describe("seeded tests", () => {
  it("WordGenerator yields the same words for the same seed", () => {
    for (const opts of [
      { language: "english" as const, punctuation: false, numbers: false },
      { language: "english_1k" as const, punctuation: true, numbers: true },
    ]) {
      const a = new WordGenerator(opts, mulberry32(12345)).take(200);
      const b = new WordGenerator(opts, mulberry32(12345)).take(200);
      const c = new WordGenerator(opts, mulberry32(12346)).take(200);
      expect(a).toEqual(b);
      expect(a).not.toEqual(c);
    }
  });

  it("newTest({ seed }) regenerates the same targets after applying the challenge config", () => {
    const c = parse(`${ORIGIN}/?m=words&n=25&s=12345&p=1`)!;
    useConfig.getState().patch({ ...challengeConfig(c), language: "english_1k" });
    useConfig.getState().patch(challengeConfig(c));
    useTest.getState().newTest({ seed: 12345 });
    const first = useTest.getState().targets;
    useTest.getState().newTest();
    expect(useTest.getState().targets).not.toEqual(first);
    useTest.getState().newTest({ seed: 12345 });
    expect(useTest.getState().targets).toEqual(first);
    expect(first).toHaveLength(25);
    expect(challengeMatchesTest(c, useTest.getState(), useConfig.getState())).toBe(true);

    useTest.getState().newTest({ repeat: true });
    expect(challengeMatchesTest(c, useTest.getState(), useConfig.getState())).toBe(true);
  });

  it("challengeConfig switches quote challenges to the quote's length group", () => {
    const long = QUOTES.find((q) => q.length > 300 && q.length <= 600)!;
    expect(challengeConfig({ kind: "quote", quoteId: long.id, wpm: null, acc: null })).toEqual({
      mode: "quote",
      quoteLength: "long",
    });
  });
});

describe("share text", () => {
  it("formats multipliers", () => {
    expect(formatMultiplier(2.377)).toBe("2.4x");
    expect(formatMultiplier(9.96)).toBe("10x");
    expect(formatMultiplier(12.4)).toBe("12x");
    expect(compareToTyping(214, null)).toMatchObject({ label: "5.4x", personal: false, typingWpm: 40 });
    expect(compareToTyping(214, 90)).toMatchObject({ label: "2.4x", personal: true });
  });

  it("brags with the typing multiplier and the challenge link", () => {
    const link = `${ORIGIN}/?m=time&n=30&s=12345&w=214&a=98`;
    expect(shareText(result({}), { typingWpm: 90, link })).toBe(
      `i just talked at 214 wpm (98% acc) on monkeyflow 🎙️\n2.4x faster than i type.\nmonkeytype, but you talk.\nbeat me → ${link}`,
    );
    expect(shareText(result({}), { typingWpm: null, link })).toContain("5.4x faster than the average typist.");
    expect(shareText(result({ wpm: 60 }), { typingWpm: 90, link })).not.toContain("faster");
  });
});

describe("daily challenge sharing", () => {
  const quote = QUOTES[0];
  const daily = result({
    mode: "quote",
    mode2: "daily",
    quote,
    timestamp: new Date(2026, 9, 29, 12).getTime(),
    words: [
      { target: "a", status: "correct", input: "a" },
      { target: "b", status: "incorrect", input: "x" },
      { target: "c", status: "correct", input: "c" },
    ],
  });

  it("shares a wordle-style grid with the daily number", () => {
    const text = shareText(daily, { typingWpm: null, link: `${ORIGIN}/?q=${quote.id}&dy=3` });
    expect(text.split("\n")).toEqual([
      "monkeyflow daily #3 🎙️",
      "214 wpm · 98% acc",
      "🟩🟥🟩",
      `${ORIGIN}/?q=${quote.id}&dy=3`,
    ]);
  });

  it("round-trips the daily number through the challenge link", () => {
    const c = challengeFromResult(daily);
    expect(c).toMatchObject({ kind: "quote", quoteId: quote.id, daily: 3 });
    const url = challengeUrl(c, ORIGIN);
    expect(url).toContain("dy=3");
    expect(parse(url)).toMatchObject({ kind: "quote", quoteId: quote.id, daily: 3, wpm: 214 });
  });

  it("plays an old daily as a plain quote so the words still match", () => {
    const c = parse(`${ORIGIN}/?q=${quote.id}&dy=1&w=200`)!;
    expect(challengeConfig(c).mode).toBe("quote");
    expect(challengeConfig(c).quoteLength).not.toBe("daily");
  });
});
