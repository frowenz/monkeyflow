import english from "../data/english.json";
import english1k from "../data/english_1k.json";
import quotesData from "../data/quotes.json";
import twistersData from "../data/tongue_twisters.json";
import spanish from "../data/languages/spanish.json";
import french from "../data/languages/french.json";
import german from "../data/languages/german.json";
import portuguese from "../data/languages/portuguese.json";
import italian from "../data/languages/italian.json";

export interface Quote {
  id: number;
  text: string;
  source: string;
  length: number;
}

export type QuoteLength = "all" | "short" | "medium" | "long" | "thicc" | "daily";
export type Language =
  | "english"
  | "english_1k"
  | "tongue_twisters"
  | "spanish"
  | "french"
  | "german"
  | "portuguese"
  | "italian";

export const LANGUAGES: Language[] = [
  "english",
  "english_1k",
  "tongue_twisters",
  "spanish",
  "french",
  "german",
  "portuguese",
  "italian",
];

const TWISTERS: string[] = (twistersData as { twisters: string[] }).twisters;

type WordList = { words: string[]; speech?: string };

const LISTS: Record<Exclude<Language, "tongue_twisters">, WordList> = {
  english: english as WordList,
  english_1k: english1k as WordList,
  spanish: spanish as WordList,
  french: french as WordList,
  german: german as WordList,
  portuguese: portuguese as WordList,
  italian: italian as WordList,
};

/** Recognizer language for a word set; English sets use the user's chosen accent. */
export function speechLangFor(language: Language, englishAccent: string): string {
  if (language === "tongue_twisters") return englishAccent;
  return LISTS[language].speech ?? englishAccent;
}

export const QUOTES: Quote[] = (quotesData as Quote[]).map((q) => ({
  ...q,
  text: q.text.replace(/\s+/g, " ").trim(),
}));

export const QUOTE_GROUPS: Record<Exclude<QuoteLength, "all" | "daily">, [number, number]> = {
  short: [0, 100],
  medium: [101, 300],
  long: [301, 600],
  thicc: [601, 9999],
};

export type Rng = () => number;

/** Small deterministic PRNG so a test can be replayed from its seed (challenge links). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function pick<T>(arr: T[], rng: Rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function randomNumberWord(rng: Rng): string {
  const len = 1 + Math.floor(rng() * 4);
  let s = String(1 + Math.floor(rng() * 9));
  for (let i = 1; i < len; i++) s += String(Math.floor(rng() * 10));
  return s;
}

export interface WordGenOptions {
  language: Language;
  punctuation: boolean;
  numbers: boolean;
}

export class WordGenerator {
  private prev: string[] = [];
  private sentenceStart = true;
  private opts: WordGenOptions;
  private rng: Rng;

  constructor(opts: WordGenOptions, rng: Rng = Math.random) {
    this.opts = opts;
    this.rng = rng;
  }

  private twisterQueue: string[] = [];
  private lastTwister = -1;

  next(): string {
    if (this.opts.language === "tongue_twisters") return this.nextTwisterWord();
    const list = LISTS[this.opts.language].words;
    let word = pick(list, this.rng);
    let guard = 0;
    while (this.prev.includes(word) && guard++ < 20) word = pick(list, this.rng);
    this.prev.push(word);
    if (this.prev.length > 2) this.prev.shift();

    if (this.opts.numbers && this.rng() < 0.1) {
      word = randomNumberWord(this.rng);
    }
    if (this.opts.punctuation) word = this.punctuate(word);
    return word;
  }

  /** Tongue twisters are read whole, in order, one random twister after another. */
  private nextTwisterWord(): string {
    if (this.twisterQueue.length === 0) {
      let idx = Math.floor(this.rng() * TWISTERS.length);
      if (idx === this.lastTwister) idx = (idx + 1) % TWISTERS.length;
      this.lastTwister = idx;
      const words = TWISTERS[idx].split(/\s+/);
      this.twisterQueue = this.opts.punctuation
        ? words
        : words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, "")).filter(Boolean);
    }
    return this.twisterQueue.shift()!;
  }

  take(count: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i++) out.push(this.next());
    if (this.opts.punctuation && out.length > 0) {
      const last = out[out.length - 1];
      if (!/[.?!]$/.test(last)) out[out.length - 1] = last.replace(/[,;:]$/, "") + ".";
    }
    return out;
  }

  private punctuate(word: string): string {
    let w = word;
    if (this.sentenceStart) {
      w = capitalize(w);
      this.sentenceStart = false;
    }
    const r = this.rng();
    if (r < 0.1) {
      w += pick([".", ".", ".", "?", "!"], this.rng);
      this.sentenceStart = true;
    } else if (r < 0.2) {
      w += pick([",", ",", ",", ";", ":"], this.rng);
    } else if (r < 0.23) {
      w = `"${w}"`;
    } else if (r < 0.25) {
      w = `(${w})`;
    } else if (r < 0.27) {
      w = `${w}'s`;
    } else if (r < 0.28) {
      w = "-";
    }
    return w;
  }
}

const DAILY_EPOCH = Date.UTC(2026, 9, 27);

/** Daily challenge number; #1 is launch day. Rolls over at local midnight, like Wordle. */
export function dailyNumber(date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - DAILY_EPOCH) / 86400000) + 1;
}

const DAILY_POOL: Quote[] = (() => {
  const pool = QUOTES.filter((q) => q.length >= 60 && q.length <= 220);
  const rng = mulberry32(20261027);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
})();

export function dailyQuote(date = new Date()): Quote {
  const n = dailyNumber(date);
  return DAILY_POOL[(((n - 1) % DAILY_POOL.length) + DAILY_POOL.length) % DAILY_POOL.length];
}

export function randomQuote(length: QuoteLength, excludeId?: number): Quote {
  if (length === "daily") return dailyQuote();
  const pool =
    length === "all"
      ? QUOTES
      : QUOTES.filter((q) => {
          const [min, max] = QUOTE_GROUPS[length];
          return q.length >= min && q.length <= max;
        });
  const candidates = pool.length > 1 ? pool.filter((q) => q.id !== excludeId) : pool;
  return pick(candidates.length ? candidates : QUOTES);
}

export function splitText(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
