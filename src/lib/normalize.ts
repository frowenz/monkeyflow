const HOMOPHONE_GROUPS: string[][] = [
  ["to", "too", "two", "2"],
  ["there", "their", "theyre"],
  ["your", "youre", "yore"],
  ["for", "four", "fore", "4"],
  ["know", "no"],
  ["knew", "new", "gnu"],
  ["right", "write", "rite", "wright"],
  ["hear", "here"],
  ["by", "buy", "bye"],
  ["one", "won", "1"],
  ["eight", "ate", "8"],
  ["whole", "hole"],
  ["through", "threw", "thru"],
  ["where", "wear", "ware"],
  ["weather", "whether"],
  ["whose", "whos"],
  ["our", "hour", "are"],
  ["see", "sea"],
  ["be", "bee"],
  ["meet", "meat"],
  ["week", "weak"],
  ["way", "weigh"],
  ["wait", "weight"],
  ["sun", "son"],
  ["piece", "peace"],
  ["plain", "plane"],
  ["road", "rode", "rowed"],
  ["so", "sew", "sow"],
  ["some", "sum"],
  ["tail", "tale"],
  ["wood", "would"],
  ["i", "eye", "aye"],
  ["which", "witch"],
  ["aloud", "allowed"],
  ["flour", "flower"],
  ["made", "maid"],
  ["mail", "male"],
  ["pair", "pear", "pare"],
  ["poor", "pour", "pore"],
  ["rain", "reign", "rein"],
  ["real", "reel"],
  ["role", "roll"],
  ["sail", "sale"],
  ["scene", "seen"],
  ["sight", "site", "cite"],
  ["stair", "stare"],
  ["steal", "steel"],
  ["tide", "tied"],
  ["waist", "waste"],
  ["war", "wore"],
  ["night", "knight"],
  ["not", "knot"],
  ["need", "knead"],
  ["break", "brake"],
  ["dear", "deer"],
  ["die", "dye"],
  ["fair", "fare"],
  ["hair", "hare"],
  ["heal", "heel"],
  ["hi", "high"],
  ["in", "inn"],
  ["lead", "led"],
  ["read", "red", "reed"],
  ["mind", "mined"],
  ["missed", "mist"],
  ["passed", "past"],
  ["principal", "principle"],
  ["sole", "soul"],
  ["stationary", "stationery"],
  ["than", "then"],
  ["okay", "ok"],
  ["mr", "mister"],
  ["mrs", "missus"],
  ["dr", "doctor"],
  ["and", "n"],
  ["oh", "o", "owe"],
  ["all", "awl"],
  ["air", "heir", "ere", "err"],
  ["cent", "scent", "sent"],
  ["chord", "cord"],
  ["council", "counsel"],
  ["course", "coarse"],
  ["days", "daze"],
  ["fined", "find"],
  ["grate", "great"],
  ["groan", "grown"],
  ["guessed", "guest"],
  ["hall", "haul"],
  ["higher", "hire"],
  ["hymn", "him"],
  ["idle", "idol"],
  ["jeans", "genes"],
  ["loan", "lone"],
  ["morning", "mourning"],
  ["none", "nun"],
  ["pail", "pale"],
  ["pain", "pane"],
  ["plum", "plumb"],
  ["rap", "wrap"],
  ["ring", "wring"],
  ["sees", "seas", "seize"],
  ["sell", "cell"],
  ["side", "sighed"],
  ["sore", "soar"],
  ["stake", "steak"],
  ["suite", "sweet"],
  ["tea", "tee"],
  ["throne", "thrown"],
  ["toe", "tow"],
  ["vain", "vein", "vane"],
  ["wade", "weighed"],
  ["ways", "weighs"],
  ["we", "wee"],
  ["weave", "weve"],
  ["whine", "wine"],
  ["yolk", "yoke"],
  ["color", "colour"],
  ["favorite", "favourite"],
  ["honor", "honour"],
  ["center", "centre"],
  ["gray", "grey"],
  ["theater", "theatre"],
  ["realize", "realise"],
  ["organize", "organise"],
  ["alright", "allright"],
  ["cannot", "cant"],
  ["till", "til", "until"],
  ["goodbye", "goodby"],
  ["percent", "%"],
  ["zero", "0", "oh"],
  ["three", "3"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["nine", "9"],
  ["ten", "10"],
];

const homophoneMap = new Map<string, Set<string>>();
for (const group of HOMOPHONE_GROUPS) {
  for (const word of group) {
    let set = homophoneMap.get(word);
    if (!set) {
      set = new Set();
      homophoneMap.set(word, set);
    }
    for (const other of group) set.add(other);
  }
}

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, a: 1,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, million: 1000000,
};

const FILLERS = new Set(["um", "uh", "uhm", "umm", "er", "erm", "hmm", "mm", "mhm", "uhh"]);

export function isFiller(normalized: string): boolean {
  return FILLERS.has(normalized);
}

/** Lowercase, strip diacritics/punctuation; keeps only [a-z0-9%]. */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]/g, "");
}

/** Converts a sequence of number words into a digit string, or null. */
export function wordsToNumber(words: string[]): string | null {
  if (words.length === 0) return null;
  if (words.length === 1 && /^\d+$/.test(words[0])) return String(Number(words[0]));
  let total = 0;
  let current = 0;
  let seen = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "and" && seen && i < words.length - 1) continue;
    if (w in ONES && !(w === "a" && i > 0) && !(w === "oh" && words.length > 1)) {
      if (w === "a" && words.length === 1) return null;
      current += ONES[w];
      seen = true;
    } else if (w in TENS) {
      current += TENS[w];
      seen = true;
    } else if (w in SCALES) {
      if (!seen && current === 0) current = 1;
      if (SCALES[w] === 100) current *= 100;
      else {
        total += current * SCALES[w];
        current = 0;
      }
      seen = true;
    } else if (/^\d+$/.test(w)) {
      current += Number(w);
      seen = true;
    } else {
      return null;
    }
  }
  if (!seen) return null;
  return String(total + current);
}

export type MatchStrictness = "lenient" | "strict";

/** Whether two already-normalized words should count as the same spoken word. */
export function normalizedEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  const ha = homophoneMap.get(a);
  if (ha && ha.has(b)) return true;
  const na = wordsToNumber([a]);
  const nb = wordsToNumber([b]);
  return na !== null && na === nb;
}

export function wordsMatch(target: string, spoken: string, strictness: MatchStrictness): boolean {
  if (strictness === "strict") return target === spoken;
  return normalizedEqual(normalizeWord(target), normalizeWord(spoken));
}

/** True when a multi-word spoken phrase equals a single target (e.g. "twenty five" -> "25"). */
export function phraseMatchesWord(targetNorm: string, spokenNorms: string[]): boolean {
  if (spokenNorms.join("") === targetNorm) return true;
  const num = wordsToNumber(spokenNorms);
  if (num !== null && wordsToNumber([targetNorm]) === num) return true;
  return false;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}
