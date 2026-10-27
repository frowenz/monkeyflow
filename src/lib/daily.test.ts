import { describe, expect, it } from "vitest";
import { emojiGrid } from "./daily";
import { dailyNumber, dailyQuote } from "./words";

describe("daily challenge", () => {
  it("numbers days from launch and rolls over at local midnight", () => {
    expect(dailyNumber(new Date(2026, 9, 27, 0, 1))).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 27, 23, 59))).toBe(1);
    expect(dailyNumber(new Date(2026, 9, 28, 0, 0))).toBe(2);
    expect(dailyNumber(new Date(2026, 11, 31, 12))).toBe(66);
  });

  it("gives everyone the same quote on a given day, and a different one tomorrow", () => {
    const a = dailyQuote(new Date(2026, 10, 3, 9));
    const b = dailyQuote(new Date(2026, 10, 3, 21));
    const c = dailyQuote(new Date(2026, 10, 4, 9));
    expect(a.id).toBe(b.id);
    expect(c.id).not.toBe(a.id);
    expect(a.length).toBeGreaterThanOrEqual(60);
    expect(a.length).toBeLessThanOrEqual(220);
  });
});

describe("emojiGrid", () => {
  it("renders statuses as rows of squares", () => {
    const words = [
      ...Array(8).fill({ status: "correct" }),
      { status: "incorrect" },
      { status: "missed" },
    ] as { status: "correct" | "incorrect" | "missed" }[];
    expect(emojiGrid(words)).toBe("🟩🟩🟩🟩🟩🟩🟩🟩\n🟥⬛");
  });

  it("widens rows so long tests fit in four lines", () => {
    const grid = emojiGrid(Array(60).fill({ status: "correct" }));
    expect(grid.split("\n")).toHaveLength(4);
  });
});
