import { describe, expect, it } from "vitest";
import { align, tokenize } from "./align";
import { isAbandonedHypothesis, phraseMatchesWord, soundsLikeJoin, wordsMatch, wordsToNumber } from "./normalize";

const T = (s: string) => s.split(" ");
const run = (target: string, spoken: string, opts: { interim?: boolean; keyboard?: boolean } = {}) =>
  align(
    T(target),
    tokenize(spoken, { strictness: "lenient", allowInProgress: opts.keyboard, interim: opts.interim }),
    "lenient",
  );
const statuses = (a: ReturnType<typeof run>) => a.words.map((w) => w.status[0]).join("");
const runStrict = (target: string, spoken: string) =>
  align(T(target), tokenize(spoken, { strictness: "strict" }), "strict");

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

  it("recovers from several dropped words once enough speech confirms it", () => {
    expect(statuses(run("a b c d e f g h i", "a e f g"))).toBe("ciii");
    expect(statuses(run("a b c d e f g h i", "a e f g h"))).toBe("cmmmcccc");
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

  it("counts a complete trailing word as correct (wispr text without trailing space)", () => {
    const a = run("the quick brown fox", "The quick brown fox.", { keyboard: true });
    expect(statuses(a)).toBe("cccc");
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

  it("is fast enough for long tests with real words, numbers and merges", () => {
    const vocab =
      "the there their to too two for four know no right write see sea be one won eight 3rd 2nd 1,000 $5 10% 2020 colour favourite centre walked pears miles twenty-five 9:00 - well-known don't it's If's into face tell form over late any think".split(
        " ",
      );
    const words = Array.from({ length: 500 }, (_, i) => vocab[(i * 7 + (i >> 3)) % vocab.length]);
    const spoken = words
      .slice(0, 400)
      .filter((_, i) => i % 17 !== 0)
      .join(" ")
      .replace(/into face/g, "interface")
      .replace(/colour/g, "color");
    const t0 = performance.now();
    const a = run(words.join(" "), spoken);
    const dt = performance.now() - t0;
    expect(a.caretWord).toBeGreaterThan(390);
    expect(dt).toBeLessThan(250);
  });
});

describe("voice scoring", () => {
  it("accepts spoken ordinals for written ones", () => {
    expect(statuses(run("The 3rd race", "the third race"))).toBe("ccc");
    expect(statuses(run("she was 2nd, and 4th", "she was second and fourth"))).toBe("ccccc");
    expect(statuses(run("on the 21st of March", "on the twenty first of March"))).toBe("ccccc");
    expect(statuses(run("21st", "21st"))).toBe("c");
    expect(statuses(run("the third man", "the 3rd man"))).toBe("ccc");
    expect(statuses(run("the 3rd man", "the fourth man"))).toBe("cic");
  });

  it("accepts American spellings of British words and vice versa", () => {
    expect(statuses(run("my favourite colour is grey", "my favorite color is gray"))).toBe("ccccc");
    expect(statuses(run("I realise the theatre centre", "I realize the theater center"))).toBe("ccccc");
    expect(statuses(run("from the harbour.", "from the harbor"))).toBe("ccc");
    expect(statuses(run("we organized our favorite labor", "we organised our favourite labour"))).toBe("ccccc");
    expect(statuses(run("we traveled toward it", "we travelled towards it"))).toBe("cccc");
    expect(statuses(run("the programme was cancelled", "the program was canceled"))).toBe("cccc");
  });

  it("keeps strict mode exact", () => {
    expect(statuses(runStrict("colour", "color"))).toBe("i");
    expect(statuses(runStrict("3rd", "third"))).toBe("i");
  });

  it("accepts homophones with plural endings but flags dropped or added endings", () => {
    expect(statuses(run("4 pears and", "four pairs and"))).toBe("ccc");
    expect(statuses(run("then walked home", "then walk home"))).toBe("cic");
    expect(statuses(run("they turn left", "they turns left"))).toBe("cic");
    expect(statuses(run("a cat sat", "a cats sat"))).toBe("cic");
    expect(statuses(run("its form", "its farm"))).toBe("ci");
  });

  it("flags a missing 's but ignores the silent apostrophe", () => {
    expect(statuses(run("If's a word", "if a word"))).toBe("icc");
    expect(statuses(run("the first's one", "the first one"))).toBe("cic");
    expect(statuses(run("the dog's bowl", "the dogs bowl"))).toBe("ccc");
    expect(statuses(run("the world's best", "the world best"))).toBe("cic");
    expect(wordsMatch("it's", "it", "lenient")).toBe(false);
    expect(wordsMatch("it's", "its", "lenient")).toBe(true);
  });

  it("matches hyphenated number words and digit runs", () => {
    expect(statuses(run("the twenty-five minute break", "the 25 minute break"))).toBe("cccc");
    expect(statuses(run("the 25 minute break", "the twenty-five minute break"))).toBe("cccc");
    expect(statuses(run("the 25 minute break", "the twenty five minute break"))).toBe("cccc");
    expect(statuses(run("call 35 1455 now", "call 35-1455 now"))).toBe("cccc");
    expect(statuses(run("23 8688 go", "238688 go"))).toBe("ccc");
    expect(statuses(run("896 951 go", "896,951 go"))).toBe("ccc");
  });

  it("does not split ordinary hyphenated words or strict-mode numbers", () => {
    expect(statuses(run("a well-known fact", "a well-known fact"))).toBe("ccc");
    expect(statuses(run("a well-known fact", "a well known fact"))).toBe("ccc");
    expect(tokenize("35-1455", { strictness: "strict" }).map((t) => t.text)).toEqual(["35-1455"]);
  });

  it("accepts clock times as Chrome formats them", () => {
    expect(statuses(run("at nine o'clock, a half-hour", "at 9:00 a half-hour"))).toBe("ccccc");
    expect(statuses(run("met at 5 p.m. on", "met at 5:00 p.m. on"))).toBe("ccccc");
    expect(statuses(run("home at 7:30.", "home at seven thirty"))).toBe("ccc");
    expect(statuses(run("at 9:00 sharp", "at nine o'clock sharp"))).toBe("ccc");
  });

  it("accepts unit and title abbreviations", () => {
    expect(statuses(run("walked 1.5 miles home", "walked 1.5 Mi home"))).toBe("cccc");
    expect(statuses(run("Dr. Smith and Mr. Jones", "doctor Smith and mister Jones"))).toBe("ccccc");
  });

  it("accepts currency, percentages, years and grouped numbers", () => {
    expect(statuses(run("cost $5 each", "cost five dollars each"))).toBe("ccc");
    expect(statuses(run("cost $5 each", "cost $5 each"))).toBe("ccc");
    expect(statuses(run("for $3.50, then", "for $3.50 then"))).toBe("ccc");
    expect(statuses(run("for $3.50, then", "for three fifty then"))).toBe("ccc");
    expect(statuses(run("for $3.50, then", "for 3.50 then"))).toBe("ccc");
    expect(phraseMatchesWord("350", ["three", "dollars", "and", "fifty", "cents"])).toBe(true);
    expect(statuses(run("about 10% more", "about ten percent more"))).toBe("ccc");
    expect(statuses(run("about 10% more", "about 10 percent more"))).toBe("ccc");
    expect(statuses(run("in 2020.", "in two thousand twenty"))).toBe("cc");
    expect(statuses(run("in 1999 to", "in nineteen ninety nine to"))).toBe("ccc");
    expect(statuses(run("by 2010 there", "by twenty ten there"))).toBe("ccc");
    expect(statuses(run("had 1,000 runners", "had one thousand runners"))).toBe("ccc");
    expect(statuses(run("were 4,500, and", "were 4500 and"))).toBe("ccc");
    expect(statuses(run("were 4,500, and", "were 4,500 and"))).toBe("ccc");
    expect(phraseMatchesWord("4500", ["four", "thousand", "five", "hundred"])).toBe(true);
    expect(phraseMatchesWord("4500", ["four", "five", "hundred"])).toBe(false);
    expect(statuses(run("walked 1.5 miles", "walked one point five miles"))).toBe("ccc");
  });

  it("parses number words strictly instead of summing them", () => {
    expect(wordsToNumber(["five", "two"])).toBeNull();
    expect(wordsToNumber(["two", "thousand", "and", "five"])).toBe("2005");
    expect(wordsToNumber(["a", "hundred"])).toBe("100");
    expect(wordsToNumber(["twentyfive"])).toBe("25");
    expect(statuses(run("7 days", "five two days"))).not.toBe("cc");
  });

  it("does not treat Object.prototype names as numbers", () => {
    expect(wordsToNumber(["constructor"])).toBeNull();
    expect(wordsToNumber(["toString"])).toBeNull();
    expect(statuses(run("constructor toString hasOwnProperty", "constructor toString hasOwnProperty"))).toBe("ccc");
    expect(statuses(run("constructor", "valueOf"))).toBe("i");
  });

  it("accepts casual contractions and spoken joins", () => {
    expect(statuses(run("I'm gonna go", "I'm going to go"))).toBe("ccc");
    expect(statuses(run("I'm going to go", "I'm gonna go"))).toBe("cccc");
    expect(statuses(run("we should wait, alright?", "we should wait all right"))).toBe("cccc");
    expect(statuses(run("Ok, so", "okay so"))).toBe("cc");
    expect(statuses(run("Don't worry", "dont worry"))).toBe("cc");
  });

  it("skips unspeakable punctuation-only targets", () => {
    const a = run("one - two", "one two");
    expect(statuses(a)).toBe("ccc");
    expect(a.caretWord).toBe(3);
    expect(statuses(run("one - two", "one dash two"))).toBe("ccc");
    // A trailing "-" completes as soon as the word before it is said, so the test can end.
    expect(statuses(run("go -", "go"))).toBe("cc");
    expect(run("go -", "go").caretWord).toBe(2);
    expect(run("go - now", "go").caretWord).toBe(2);
  });

  it("treats a finalized wrong last word as an attempt so the test can end", () => {
    const final = run("the cat sat", "the cat xylophone");
    expect(statuses(final)).toBe("cci");
    expect(final.caretWord).toBe(3);
    expect(final.extras).toEqual([]);
    const interim = run("the cat sat", "the cat xylophone", { interim: true });
    expect(statuses(interim)).toBe("cci");
    expect(interim.caretWord).toBe(3);
    expect(interim.extras).toEqual([]);
  });

  it("matches merges of homophones and letter names", () => {
    expect(statuses(run("go down write now", "go downright now"))).toBe("cccc");
    expect(statuses(run("not be see now", "not BC now"))).toBe("cccc");
    expect(statuses(run("good will hunting", "Goodwill hunting"))).toBe("ccc");
  });

  it("matches one recognized word that sounds like two targets run together", () => {
    expect(statuses(run("go into face now", "go interface now"))).toBe("cccc");
    expect(statuses(run("tell form us", "teleform us"))).toBe("ccc");
    expect(statuses(run("come part with", "compart with"))).toBe("ccc");
    expect(statuses(run("man go.", "mango"))).toBe("cc");
    expect(statuses(run("to can find before", "to confined before"))).toBe("cccc");
    expect(statuses(run("all govern end go", "all government go"))).toBe("cccc");
    expect(statuses(run("in while life about", "in Wildlife about"))).toBe("cccc");
    expect(soundsLikeJoin("interface", "into", "face")).toBe(true);
    expect(soundsLikeJoin("interest", "into", "face")).toBe(false);
    expect(soundsLikeJoin("into", "into", "face")).toBe(false);
    expect(statuses(run("go into face now", "go interest now"))).not.toBe("cccc");
    expect(statuses(run("go into face now", "go into now"))).toBe("cci");
    expect(statuses(run("go into face now please", "go into now please"))).toBe("ccmcc");
  });

  it("detects abandoned interim hypotheses", () => {
    expect(isAbandonedHypothesis("the quick brown", "fox jumps over", 1200)).toBe(true);
    expect(isAbandonedHypothesis("the quick brown", "the quick brown fox", 1500)).toBe(false);
    expect(isAbandonedHypothesis("the quick brown", "the quack brown fox", 1500)).toBe(false);
    expect(isAbandonedHypothesis("the quick brown", "fox jumps over", 500)).toBe(false);
    expect(isAbandonedHypothesis("", "fox", 2000)).toBe(false);
  });

  it("keeps the wordsMatch contract used for the last-word check", () => {
    expect(wordsMatch("there", "their", "lenient")).toBe(true);
    expect(wordsMatch("3rd", "third", "lenient")).toBe(true);
    expect(wordsMatch("colour", "color", "lenient")).toBe(true);
    expect(wordsMatch("there", "their", "strict")).toBe(false);
    expect(wordsMatch("cat", "dog", "lenient")).toBe(false);
  });
});

describe("sequential feel", () => {
  it("marks a wrong word red in place and advances the caret", () => {
    const a = run("the quick brown fox jumps", "the quick banana");
    expect(statuses(a)).toBe("cci");
    expect(a.caretWord).toBe(3);
  });

  it("does not jump ahead to a later copy of a common word", () => {
    const a = run("go to the store and the park", "go to a");
    expect(statuses(a)).toBe("cci");
    expect(a.caretWord).toBe(3);
    const b = run("we make the best of the day", "we the");
    expect(statuses(b)).toBe("ci");
    expect(b.caretWord).toBe(2);
  });

  it("ignores filler words instead of burning a slot", () => {
    const a = run("the quick brown fox", "the um quick uh");
    expect(statuses(a)).toBe("cc");
    expect(a.caretWord).toBe(2);
  });

  it("re-syncs after an inserted word once two words confirm it", () => {
    expect(statuses(run("the quick brown fox jumps", "the really quick"))).toBe("cii");
    expect(statuses(run("the quick brown fox jumps", "the really quick brown"))).toBe("ccc");
  });

  it("re-syncs after a skipped word once two words confirm it", () => {
    expect(statuses(run("the quick brown fox jumps", "the brown"))).toBe("ci");
    expect(statuses(run("the quick brown fox jumps", "the brown fox"))).toBe("cmcc");
  });
});
