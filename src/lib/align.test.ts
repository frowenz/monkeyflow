import { describe, expect, it } from "vitest";
import { align, tokenize } from "./align";

const T = (s: string) => s.split(" ");
const run = (target: string, spoken: string, opts: { interim?: boolean; keyboard?: boolean } = {}) =>
  align(
    T(target),
    tokenize(spoken, { strictness: "lenient", allowInProgress: opts.keyboard, interim: opts.interim }),
    "lenient",
  );
const statuses = (a: ReturnType<typeof run>) => a.words.map((w) => w.status[0]).join("");

describe("align", () => {
  it("matches exact speech and ignores case/punctuation", () => {
    const a = run("the quick brown fox", "The quick, brown fox.");
    expect(statuses(a)).toBe("cccc");
    expect(a.caretWord).toBe(4);
  });

  it("leaves unspoken words pending", () => {
    const a = run("the quick brown fox jumps", "the quick");
    expect(statuses(a)).toBe("cc");
    expect(a.caretWord).toBe(2);
  });

  it("recovers from a dropped word", () => {
    const a = run("the quick brown fox jumps over", "the quick fox jumps");
    expect(statuses(a)).toBe("ccmcc");
    expect(a.caretWord).toBe(5);
  });

  it("recovers from several dropped words once speech continues", () => {
    const a = run("a b c d e f g h", "a e f g");
    expect(statuses(a)).toBe("cmmmccc");
  });

  it("treats inserted words as extras", () => {
    const a = run("the quick brown fox", "the um quick really brown fox");
    expect(statuses(a)).toBe("cccc");
    expect(a.extras.map((e) => e.text)).toEqual(["um", "really"]);
    expect(a.extraWords).toBe(1);
  });

  it("marks misrecognitions as incorrect but keeps going", () => {
    const a = run("the cat sat on the mat", "the bat sat on the mat");
    expect(statuses(a)).toBe("cicccc");
  });

  it("accepts homophones and numbers", () => {
    expect(statuses(run("there are two ways to know", "their are 2 ways too no"))).toBe("cccccc");
    expect(statuses(run("i have 25 apples", "I have twenty five apples"))).toBe("cccc");
    expect(statuses(run("over 300 people", "over three hundred people"))).toBe("ccc");
  });

  it("handles compound splits and merges", () => {
    expect(statuses(run("every day we go", "everyday we go"))).toBe("cccc");
    expect(statuses(run("we cannot go", "we can not go"))).toBe("ccc");
  });

  it("renders a half typed keyboard word as partial without jumping ahead", () => {
    const a = run("the dog cat", "the c", { keyboard: true });
    expect(statuses(a)).toBe("cp");
    expect(a.caretWord).toBe(1);
    expect(a.caretLetter).toBe(1);
  });

  it("treats a complete trailing word as partial-correct (wispr without trailing space)", () => {
    const a = run("the quick brown fox", "The quick brown fox", { keyboard: true });
    expect(statuses(a)).toBe("cccp");
    expect(a.caretWord).toBe(3);
    expect(a.caretLetter).toBe(3);
  });

  it("is fast enough for long tests", () => {
    const words = Array.from({ length: 500 }, (_, i) => `w${i % 97}x${i % 13}`);
    const spoken = words.slice(0, 400).filter((_, i) => i % 17 !== 0).join(" ");
    const t0 = performance.now();
    const a = run(words.join(" "), spoken);
    const dt = performance.now() - t0;
    expect(a.caretWord).toBeGreaterThan(390);
    expect(dt).toBeLessThan(250);
  });
});
