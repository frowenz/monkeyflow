import english from "../data/english.json";
import english1k from "../data/english_1k.json";
import quotesData from "../data/quotes.json";

export interface Quote {
  id: number;
  text: string;
  source: string;
  length: number;
}

export type QuoteLength = "all" | "short" | "medium" | "long" | "thicc";
export type Language = "english" | "english_1k";

const LISTS: Record<Language, string[]> = {
  english: (english as { words: string[] }).words,
  english_1k: (english1k as { words: string[] }).words,
};

export const QUOTES: Quote[] = (quotesData as Quote[]).map((q) => ({
  ...q,
  text: q.text.replace(/\s+/g, " ").trim(),
}));

export const QUOTE_GROUPS: Record<Exclude<QuoteLength, "all">, [number, number]> = {
  short: [0, 100],
  medium: [101, 300],
  long: [301, 600],
  thicc: [601, 9999],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function randomNumberWord(): string {
  const len = 1 + Math.floor(Math.random() * 4);
  let s = String(1 + Math.floor(Math.random() * 9));
  for (let i = 1; i < len; i++) s += String(Math.floor(Math.random() * 10));
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

  constructor(opts: WordGenOptions) {
    this.opts = opts;
  }

  next(): string {
    const list = LISTS[this.opts.language];
    let word = pick(list);
    let guard = 0;
    while (this.prev.includes(word) && guard++ < 20) word = pick(list);
    this.prev.push(word);
    if (this.prev.length > 2) this.prev.shift();

    if (this.opts.numbers && Math.random() < 0.1) {
      word = randomNumberWord();
    }
    if (this.opts.punctuation) word = this.punctuate(word);
    return word;
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
    const r = Math.random();
    if (r < 0.1) {
      w += pick([".", ".", ".", "?", "!"]);
      this.sentenceStart = true;
    } else if (r < 0.2) {
      w += pick([",", ",", ",", ";", ":"]);
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

export function randomQuote(length: QuoteLength, excludeId?: number): Quote {
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
