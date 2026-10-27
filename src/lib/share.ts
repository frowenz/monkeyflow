import { DEFAULT_CONFIG, type Config } from "../store/config";
import type { TestResult } from "../store/test";
import { dailyNumber, dailyQuote, LANGUAGES, QUOTE_GROUPS, QUOTES, type Language, type Quote, type QuoteLength } from "./words";
import { emojiGrid } from "./daily";
import { BASE } from "./base";

export const AVERAGE_TYPIST_WPM = 40;
const TYPING_WPM_KEY = "monkeyflow-typing-wpm";

export function loadTypingWpm(): number | null {
  try {
    const n = Number(localStorage.getItem(TYPING_WPM_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveTypingWpm(wpm: number | null): void {
  try {
    if (wpm === null) localStorage.removeItem(TYPING_WPM_KEY);
    else localStorage.setItem(TYPING_WPM_KEY, String(wpm));
  } catch {
    // storage unavailable (private mode); the value just won't persist
  }
}

export function formatMultiplier(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0x";
  const tenths = Math.round(ratio * 10) / 10;
  return tenths >= 10 ? `${Math.round(ratio)}x` : `${tenths.toFixed(1)}x`;
}

export interface TypingComparison {
  ratio: number;
  label: string;
  /** Compared against the user's own typing speed rather than the average typist. */
  personal: boolean;
  typingWpm: number;
}

export function compareToTyping(wpm: number, typingWpm: number | null): TypingComparison {
  const base = typingWpm ?? AVERAGE_TYPIST_WPM;
  const ratio = wpm / base;
  return { ratio, label: formatMultiplier(ratio), personal: typingWpm !== null, typingWpm: base };
}

/* ---------- challenge links ---------- */

function toLanguage(value: string | null): Language | null {
  if (value === null) return null;
  const key = value.replace(/ /g, "_");
  return LANGUAGES.find((l) => l === key) ?? null;
}

interface Score {
  wpm: number | null;
  acc: number | null;
}

export type Challenge = Score &
  (
    | { kind: "quote"; quoteId: number; /** daily challenge number, when shared from a daily */ daily?: number }
    | {
        kind: "seed";
        mode: "time" | "words";
        n: number;
        seed: number;
        punctuation: boolean;
        numbers: boolean;
        language: Language;
      }
  );

export function challengeFromResult(r: TestResult): Challenge | null {
  const score: Score = r.invalid || r.wpm <= 0 ? { wpm: null, acc: null } : { wpm: Math.round(r.wpm), acc: Math.floor(r.acc) };
  if (r.mode === "quote" && r.quote) {
    const daily = r.mode2 === "daily" ? dailyNumber(new Date(r.timestamp)) : undefined;
    return { kind: "quote", quoteId: r.quote.id, ...(daily ? { daily } : {}), ...score };
  }
  if (r.mode !== "time" && r.mode !== "words") return null;
  const n = Number(r.mode2);
  const language = toLanguage(r.language);
  if (!Number.isInteger(n) || n <= 0 || !language) return null;
  return {
    kind: "seed",
    mode: r.mode,
    n,
    seed: r.seed,
    punctuation: r.punctuation,
    numbers: r.numbers,
    language,
    ...score,
  };
}

export function challengeUrl(c: Challenge | null, origin: string = window.location.origin): string {
  if (!c) return `${origin}${BASE}`;
  const p = new URLSearchParams();
  if (c.kind === "quote") {
    p.set("q", String(c.quoteId));
    if (c.daily) p.set("dy", String(c.daily));
  } else {
    p.set("m", c.mode);
    p.set("n", String(c.n));
    p.set("s", String(c.seed));
    if (c.punctuation) p.set("p", "1");
    if (c.numbers) p.set("d", "1");
    if (c.language !== DEFAULT_CONFIG.language) p.set("l", c.language);
  }
  if (c.wpm !== null) p.set("w", String(c.wpm));
  if (c.acc !== null) p.set("a", String(c.acc));
  return `${origin}${BASE}?${p}`;
}

export const CHALLENGE_PARAMS = ["q", "dy", "m", "n", "s", "p", "d", "l", "w", "a"] as const;

export function hasChallengeParams(params: URLSearchParams): boolean {
  return params.has("q") || params.has("s");
}

function intParam(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function numParam(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Returns null when the params don't describe a test we can reproduce. */
export function parseChallenge(params: URLSearchParams): Challenge | null {
  const wpm = numParam(params.get("w"), 0, 999);
  const acc = numParam(params.get("a"), 0, 100);
  const score: Score = { wpm: wpm === null ? null : Math.round(wpm), acc: acc === null ? null : Math.floor(acc) };

  if (params.has("q")) {
    const quoteId = intParam(params.get("q"), 0, Number.MAX_SAFE_INTEGER);
    if (quoteId === null || !QUOTES.some((q) => q.id === quoteId)) return null;
    const daily = intParam(params.get("dy"), 1, 1_000_000);
    return { kind: "quote", quoteId, ...(daily ? { daily } : {}), ...score };
  }

  const mode = params.get("m");
  const n = intParam(params.get("n"), 1, 10000);
  const seed = intParam(params.get("s"), 0, 2 ** 32 - 1);
  const language = params.has("l") ? toLanguage(params.get("l")) : DEFAULT_CONFIG.language;
  if ((mode !== "time" && mode !== "words") || n === null || seed === null || !language) return null;
  return {
    kind: "seed",
    mode,
    n,
    seed,
    punctuation: params.get("p") === "1",
    numbers: params.get("d") === "1",
    language,
    ...score,
  };
}

function quoteLengthFor(quote: Quote | undefined): QuoteLength {
  if (!quote) return "all";
  const entry = Object.entries(QUOTE_GROUPS).find(([, [min, max]]) => quote.length >= min && quote.length <= max);
  return (entry?.[0] as QuoteLength | undefined) ?? "all";
}

/** Config the challenged test needs; unset flags are written explicitly so local settings can't change the words. */
export function challengeConfig(c: Challenge): Partial<Config> {
  if (c.kind === "quote") {
    const isToday = c.daily !== undefined && c.daily === dailyNumber() && dailyQuote().id === c.quoteId;
    return { mode: "quote", quoteLength: isToday ? "daily" : quoteLengthFor(QUOTES.find((q) => q.id === c.quoteId)) };
  }
  return {
    mode: c.mode,
    ...(c.mode === "time" ? { time: c.n } : { words: c.n }),
    punctuation: c.punctuation,
    numbers: c.numbers,
    language: c.language,
  };
}

export function challengeMatchesResult(c: Challenge, r: TestResult): boolean {
  if (c.kind === "quote") return r.mode === "quote" && r.quote?.id === c.quoteId;
  return (
    r.mode === c.mode &&
    r.mode2 === String(c.n) &&
    r.seed === c.seed &&
    r.punctuation === c.punctuation &&
    r.numbers === c.numbers &&
    toLanguage(r.language) === c.language
  );
}

export function challengeMatchesTest(
  c: Challenge,
  test: { seed: number; quote: Quote | null },
  config: Pick<Config, "mode" | "time" | "words" | "punctuation" | "numbers" | "language">,
): boolean {
  if (c.kind === "quote") return config.mode === "quote" && test.quote?.id === c.quoteId;
  return (
    config.mode === c.mode &&
    (c.mode === "time" ? config.time : config.words) === c.n &&
    test.seed === c.seed &&
    config.punctuation === c.punctuation &&
    config.numbers === c.numbers &&
    config.language === c.language
  );
}

export type ChallengeOutcome = "beat" | "tied" | "short";

export function challengeOutcome(target: number, r: TestResult): ChallengeOutcome {
  if (r.invalid) return "short";
  const wpm = Math.round(r.wpm);
  return wpm > target ? "beat" : wpm === target ? "tied" : "short";
}

/* ---------- sharing ---------- */

export function shareText(r: TestResult, opts: { typingWpm: number | null; link: string }): string {
  const cmp = compareToTyping(r.wpm, opts.typingWpm);
  if (r.mode === "quote" && r.mode2 === "daily") {
    const lines = [`monkeyflow daily #${dailyNumber(new Date(r.timestamp))} 🎙️`, `${Math.round(r.wpm)} wpm · ${Math.floor(r.acc)}% acc`];
    const grid = emojiGrid(r.words);
    if (grid) lines.push(grid);
    lines.push(opts.link);
    return lines.join("\n");
  }
  const lines = [`i just talked at ${Math.round(r.wpm)} wpm (${Math.floor(r.acc)}% acc) on monkeyflow 🎙️`];
  if (cmp.ratio >= 1.05) {
    lines.push(cmp.personal ? `${cmp.label} faster than i type.` : `${cmp.label} faster than the average typist.`);
  }
  lines.push("monkeytype, but you talk.");
  lines.push(`beat me → ${opts.link}`);
  return lines.join("\n");
}

export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // insecure context or denied permission: try the legacy path
  }
  const active = document.activeElement as HTMLElement | null;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus();
  return ok;
}
