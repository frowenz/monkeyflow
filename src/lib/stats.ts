import type { Alignment, SpokenToken } from "./align";

export interface CharCounts {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export function countChars(targets: string[], alignment: Alignment): CharCounts {
  const counts: CharCounts = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  alignment.words.forEach((w, i) => {
    const target = targets[i] ?? "";
    if (w.status === "correct") {
      counts.correct += target.length;
    } else if (w.status === "incorrect") {
      counts.incorrect += target.length;
    } else if (w.status === "missed") {
      counts.missed += target.length;
    } else if (w.status === "partial") {
      const input = w.input;
      for (let k = 0; k < Math.max(input.length, target.length); k++) {
        if (k >= input.length) break;
        if (k >= target.length) counts.extra++;
        else if (input[k] === target[k]) counts.correct++;
        else counts.incorrect++;
      }
    }
  });
  for (const e of alignment.extras) counts.extra += e.text.length;
  return counts;
}

/** Characters that count towards wpm: letters of correct words plus one space each. */
export function correctWpmChars(targets: string[], alignment: Alignment): number {
  let chars = 0;
  alignment.words.forEach((w, i) => {
    const t = targets[i] ?? "";
    if (w.status === "correct") chars += t.length + 1;
    else if (w.status === "partial" && w.input === t) chars += t.length;
  });
  return chars;
}

export function rawChars(tokens: SpokenToken[]): number {
  let chars = 0;
  for (const t of tokens) chars += t.norm.length + 1;
  return chars;
}

export function errorCount(alignment: Alignment): number {
  return alignment.incorrectWords + alignment.missedWords + alignment.extraWords;
}

export function wpmFromChars(chars: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return (chars / 5) * (60 / seconds);
}

export function accuracy(c: CharCounts): number {
  const total = c.correct + c.incorrect + c.extra + c.missed;
  if (total === 0) return 0;
  return (c.correct / total) * 100;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
}

export function kogasa(cov: number): number {
  return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
}

export function consistency(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return 100;
  const m = mean(v);
  if (m === 0) return 0;
  const c = kogasa(stdDev(v) / m);
  return Math.max(0, Math.min(100, c));
}

export function smooth(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return mean(slice);
  });
}
