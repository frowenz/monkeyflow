import type { HistoryWord } from "../store/test";

const SQUARES: Record<HistoryWord["status"], string> = {
  correct: "\u{1F7E9}",
  partial: "\u{1F7E8}",
  incorrect: "\u{1F7E5}",
  missed: "\u2B1B",
  untouched: "\u2B1C",
};

/** Wordle-style grid of how each word went, e.g. for "monkeyflow daily #3" shares. */
export function emojiGrid(words: Pick<HistoryWord, "status">[], maxRows = 4): string {
  if (words.length === 0) return "";
  const perRow = Math.min(15, Math.max(8, Math.ceil(words.length / maxRows)));
  const rows: string[] = [];
  for (let i = 0; i < words.length && rows.length < maxRows; i += perRow) {
    rows.push(
      words
        .slice(i, i + perRow)
        .map((w) => SQUARES[w.status])
        .join(""),
    );
  }
  return rows.join("\n");
}
