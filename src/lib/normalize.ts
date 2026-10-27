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
  ["ad", "add"],
  ["ant", "aunt"],
  ["ball", "bawl"],
  ["band", "banned"],
  ["bare", "bear"],
  ["base", "bass"],
  ["beat", "beet"],
  ["been", "bean"],
  ["berry", "bury"],
  ["blew", "blue"],
  ["board", "bored"],
  ["border", "boarder"],
  ["bread", "bred"],
  ["cereal", "serial"],
  ["cheap", "cheep"],
  ["chews", "choose"],
  ["colonel", "kernel"],
  ["creak", "creek"],
  ["current", "currant"],
  ["dew", "due"],
  ["doe", "dough"],
  ["feat", "feet"],
  ["flea", "flee"],
  ["flew", "flu", "flue"],
  ["foul", "fowl"],
  ["gate", "gait"],
  ["hay", "hey"],
  ["heard", "herd"],
  ["isle", "aisle", "ill"],
  ["key", "quay"],
  ["knows", "nose"],
  ["leak", "leek"],
  ["lessen", "lesson"],
  ["main", "mane"],
  ["might", "mite"],
  ["miner", "minor"],
  ["muscle", "mussel"],
  ["naval", "navel"],
  ["or", "oar", "ore"],
  ["patience", "patients"],
  ["pause", "paws"],
  ["peak", "peek", "pique"],
  ["pole", "poll"],
  ["pray", "prey"],
  ["presence", "presents"],
  ["profit", "prophet"],
  ["raise", "rays", "raze"],
  ["root", "route"],
  ["rose", "rows"],
  ["seam", "seem"],
  ["shoe", "shoo"],
  ["story", "storey"],
  ["symbol", "cymbal"],
  ["taught", "taut"],
  ["tear", "tier"],
  ["wail", "whale"],
  ["weed", "wed"],
  ["whirled", "world"],
  ["you", "ewe", "u"],
  ["gonna", "goingto"],
  ["wanna", "wantto"],
  ["gotta", "gotto"],
  ["kinda", "kindof"],
  ["sorta", "sortof"],
  ["outta", "outof"],
  ["lemme", "letme"],
  ["gimme", "giveme"],
  ["dunno", "dontknow"],
  ["cause", "cuz", "coz"],
  ["etc", "etcetera"],
  // Letter names, which Chrome writes for runs like "be see" -> "BC".
  ["be", "b"],
  ["see", "c"],
  ["are", "r"],
  ["why", "y"],
  ["tea", "t"],
  ["queue", "cue", "q"],
  ["jay", "j"],
  ["ex", "x"],
];

/** Lookup table without Object.prototype keys, so words like "constructor" aren't found. */
function dict<T>(entries: Record<string, T>): Record<string, T> {
  return Object.assign(Object.create(null) as Record<string, T>, entries);
}

/** Spoken/written abbreviations: either form matches any expansion. */
const ABBREVIATIONS = dict<string[]>({
  mi: ["mile", "miles"],
  km: ["kilometer", "kilometers", "kilometre", "kilometres"],
  kg: ["kilogram", "kilograms", "kilo", "kilos"],
  lb: ["pound", "pounds"],
  lbs: ["pound", "pounds"],
  oz: ["ounce", "ounces"],
  ft: ["foot", "feet"],
  yd: ["yard", "yards"],
  yds: ["yard", "yards"],
  hr: ["hour", "hours"],
  hrs: ["hour", "hours"],
  min: ["minute", "minutes"],
  mins: ["minute", "minutes"],
  sec: ["second", "seconds"],
  secs: ["second", "seconds"],
  st: ["street", "saint"],
  ave: ["avenue"],
  rd: ["road"],
  blvd: ["boulevard"],
  mt: ["mount", "mountain"],
  jr: ["junior"],
  sr: ["senior"],
  vs: ["versus"],
  ms: ["miss"],
  prof: ["professor"],
  approx: ["approximately"],
  dept: ["department"],
  govt: ["government"],
  tv: ["television"],
});

/** British -> American spellings that the suffix rules below don't cover. */
const SPELLING_PAIRS = dict<string>({
  grey: "gray",
  greys: "grays",
  programme: "program",
  programmes: "programs",
  cheque: "check",
  cheques: "checks",
  tyre: "tire",
  tyres: "tires",
  plough: "plow",
  aluminium: "aluminum",
  kerb: "curb",
  draught: "draft",
  mould: "mold",
  smoulder: "smolder",
  moustache: "mustache",
  pyjamas: "pajamas",
  sceptic: "skeptic",
  sceptical: "skeptical",
  whisky: "whiskey",
  ageing: "aging",
  judgement: "judgment",
  acknowledgement: "acknowledgment",
  axe: "ax",
  doughnut: "donut",
  artefact: "artifact",
  cosy: "cozy",
  practise: "practice",
  practised: "practiced",
  practising: "practicing",
  licence: "license",
  defence: "defense",
  offence: "offense",
  pretence: "pretense",
  catalogue: "catalog",
  dialogue: "dialog",
  analogue: "analog",
  manoeuvre: "maneuver",
  jewellery: "jewelry",
  enrol: "enroll",
  fulfil: "fulfill",
  skilful: "skillful",
  wilful: "willful",
  instalment: "installment",
  learnt: "learned",
  spelt: "spelled",
  dreamt: "dreamed",
  burnt: "burned",
  leapt: "leaped",
  spoilt: "spoiled",
  towards: "toward",
  afterwards: "afterward",
  amongst: "among",
  whilst: "while",
  favourite: "favorite",
  favourites: "favorites",
});

const L_DOUBLING_STEMS = new Set(
  "travel cancel label model fuel level signal total counsel jewel marvel quarrel dial duel rival tunnel channel panel pencil shovel libel parcel pedal barrel grovel hostel ravel revel swivel towel yodel equal".split(" "),
);

const homophoneGroupsOf = new Map<string, number[]>();
HOMOPHONE_GROUPS.forEach((group, gi) => {
  for (const word of group) {
    const list = homophoneGroupsOf.get(word);
    if (list) list.push(gi);
    else homophoneGroupsOf.set(word, [gi]);
  }
});

const ONES = dict<number>({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
});
const TEENS = dict<number>({
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
});
const TENS = dict<number>({
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
});
const SCALES = dict<number>({
  thousand: 1e3, million: 1e6, billion: 1e9,
});
const ORDINALS = dict<number>({
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
  ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60,
  seventieth: 70, eightieth: 80, ninetieth: 90,
});
const ORDINAL_SCALES = dict<number>({
  hundredth: 100, thousandth: 1e3, millionth: 1e6,
});
const ZEROS = new Set(["zero", "oh", "o"]);
const CURRENCY_WORDS = new Set(["dollar", "dollars", "buck", "bucks", "cent", "cents", "euro", "euros", "pound", "pounds"]);

const FILLERS = new Set(["um", "uh", "uhm", "umm", "er", "erm", "hmm", "mm", "mhm", "uhh"]);

export function isFiller(normalized: string): boolean {
  return FILLERS.has(normalized);
}

/** Lowercase, strip diacritics/punctuation; keeps only [a-z0-9%]. */
export function normalizeWord(word: string): string {
  const w = word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (w === "&") return "and";
  return w.replace(/[^a-z0-9%]/g, "");
}

/** Splits hyphen-stripped number words like "twentyfive" or "twentyfirst" into parts. */
function splitNumberCompound(w: string): string[] | null {
  for (const tens of Object.keys(TENS)) {
    if (w.length > tens.length && w.startsWith(tens)) {
      const rest = w.slice(tens.length);
      if (rest in ONES || (rest in ORDINALS && ORDINALS[rest] < 10)) return [tens, rest];
    }
  }
  return null;
}

function expandNumberWords(words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    const parts = w in ONES || w in TENS || w in TEENS ? null : splitNumberCompound(w);
    if (parts) out.push(...parts);
    else out.push(w);
  }
  return out;
}

/** Strict cardinal parse ("two thousand and five" -> 2005); null when the words aren't one number. */
function cardinal(words: string[]): number | null {
  if (words.length === 0) return null;
  if (words.length === 1) {
    const w = words[0];
    if (/^\d+$/.test(w)) return Number(w);
    if (w === "zero") return 0;
  }
  let total = 0;
  let cur = 0;
  let last: "" | "ones" | "teen" | "tens" | "hundred" | "scale" | "digits" = "";
  let lastScale = Infinity;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (w === "and") {
      if ((last === "hundred" || last === "scale") && next !== undefined) continue;
      return null;
    }
    if (w === "a" && i === 0 && (next === "hundred" || (next !== undefined && next in SCALES))) {
      cur = 1;
      last = "ones";
    } else if (w in ONES) {
      if (last !== "" && last !== "tens" && last !== "hundred" && last !== "scale") return null;
      cur += ONES[w];
      last = "ones";
    } else if (w in TEENS) {
      if (last !== "" && last !== "hundred" && last !== "scale") return null;
      cur += TEENS[w];
      last = "teen";
    } else if (w in TENS) {
      if (last !== "" && last !== "hundred" && last !== "scale") return null;
      cur += TENS[w];
      last = "tens";
    } else if (w === "hundred") {
      if (last === "hundred" || last === "scale") return null;
      if (last === "") cur = 1;
      if (cur % 100 === 0 || cur >= 100) return null;
      cur *= 100;
      last = "hundred";
    } else if (w in SCALES) {
      const s = SCALES[w];
      if (s >= lastScale) return null;
      if (last === "") cur = 1;
      if (cur === 0) return null;
      total += cur * s;
      cur = 0;
      lastScale = s;
      last = "scale";
    } else if (/^\d+$/.test(w)) {
      if (last !== "" && last !== "scale") return null;
      cur += Number(w);
      last = "digits";
    } else {
      return null;
    }
  }
  if (last === "") return null;
  return total + cur;
}

/** Value of a spoken ordinal ("twenty first" -> 21, "3rd" -> 3), or null. */
function ordinal(words: string[]): number | null {
  if (words.length === 0) return null;
  const lastWord = words[words.length - 1];
  const head = words.slice(0, -1);
  const digit = /^(\d+)(st|nd|rd|th)$/.exec(lastWord);
  if (digit) return head.length === 0 ? Number(digit[1]) : null;
  if (lastWord in ORDINALS) {
    if (head.length === 0) return ORDINALS[lastWord];
    const base = cardinal(head);
    if (base === null || (base % 10 !== 0 && ORDINALS[lastWord] < 10)) return null;
    if (ORDINALS[lastWord] >= 10 && base % 100 !== 0) return null;
    return base + ORDINALS[lastWord];
  }
  if (lastWord in ORDINAL_SCALES) {
    const base = head.length === 0 ? 1 : cardinal(head);
    return base === null ? null : base * ORDINAL_SCALES[lastWord];
  }
  return null;
}

/** Every plausible digit-string reading of a run of number words (cardinal, year/time style, digit by digit). */
export function numberReadings(input: string[]): string[] {
  let words = expandNumberWords(input.filter((w) => w.length > 0));
  if (words.length === 0) return [];
  const out = new Set<string>();

  let suffix = "";
  const lastWord = words[words.length - 1];
  if (lastWord === "percent" || lastWord === "%") {
    suffix = "%";
    words = words.slice(0, -1);
  } else if (words.length >= 2 && lastWord === "cent" && words[words.length - 2] === "per") {
    suffix = "%";
    words = words.slice(0, -2);
  } else if (/^\d+%$/.test(lastWord) && words.length === 1) {
    return [lastWord];
  }
  if (suffix === "" && words.some((w) => CURRENCY_WORDS.has(w))) {
    // "three dollars and fifty cents" -> "three fifty" (written "$3.50", normalized "350")
    const stripped = words.filter((w) => !CURRENCY_WORDS.has(w) && w !== "and");
    if (stripped.length > 0) words = stripped;
  }
  if (words.length === 0) return [];
  if (words.length > 1 && words[words.length - 1] === "oclock") {
    const head = words.slice(0, -1);
    for (const r of numberReadings(head)) {
      out.add(r);
      out.add(`${r}00`);
    }
    return [...out];
  }

  const c = cardinal(words);
  if (c !== null) out.add(String(c) + suffix);

  if (words.length >= 2) {
    // "nineteen ninety nine" -> 1999, "seven thirty" -> 730, "twenty oh five" -> 2005
    for (let p = 1; p < words.length; p++) {
      const a = cardinal(words.slice(0, p));
      if (a === null || a < 1 || a > 99) continue;
      const rest = words.slice(p);
      let b: number | null = null;
      if (rest.length === 2 && ZEROS.has(rest[0]) && rest[1] in ONES) b = ONES[rest[1]];
      else {
        const v = cardinal(rest);
        if (v !== null && v >= 10 && v <= 99) b = v;
      }
      if (b !== null) out.add(String(a * 100 + b) + suffix);
    }
    // digit by digit: "four oh four" -> 404, "1 4 55" -> 1455
    const pieces: string[] = [];
    for (const w of words) {
      if (/^\d+$/.test(w)) pieces.push(w);
      else if (w in ONES) pieces.push(String(ONES[w]));
      else if (ZEROS.has(w)) pieces.push("0");
      else {
        pieces.length = 0;
        break;
      }
    }
    if (pieces.length === words.length) out.add(pieces.join("") + suffix);
    // decimals: "one point five" -> 15 (normalized "1.5")
    const pi = words.indexOf("point");
    if (pi >= 0 && pi < words.length - 1) {
      const whole = pi === 0 ? 0 : cardinal(words.slice(0, pi));
      const frac = words.slice(pi + 1).map((w) => (/^\d$/.test(w) ? w : w in ONES ? String(ONES[w]) : ZEROS.has(w) ? "0" : null));
      if (whole !== null && frac.every((d) => d !== null)) out.add(String(whole) + frac.join("") + suffix);
    }
  }
  return [...out];
}

/** Converts a sequence of number words into a digit string, or null. */
export function wordsToNumber(words: string[]): string | null {
  if (words.length === 0) return null;
  if (words.length === 1 && /^\d+$/.test(words[0])) return String(Number(words[0]));
  const c = cardinal(expandNumberWords(words));
  return c === null ? null : String(c);
}

/** Maps common British spellings onto American ones so either matches. */
export function americanize(w: string): string {
  if (w.length < 4) return w;
  const pair = SPELLING_PAIRS[w];
  if (pair) return pair;
  let m = /^([a-z]{2,})our(s|ed|ing|ite|ites|able|ably|er|ers|ful|less|ism|ist|hood|hoods|ly)?$/.exec(w);
  if (m) return `${m[1]}or${m[2] ?? ""}`;
  m = /^([a-z]{3,})is(e|es|ed|ing|er|ers|ation|ations)$/.exec(w);
  if (m) return `${m[1]}iz${m[2]}`;
  m = /^([a-z]{3,})ys(e|es|ed|ing)$/.exec(w);
  if (m) return `${m[1]}yz${m[2]}`;
  m = /^([a-z]{2,}[^aeiou])re(s)?$/.exec(w);
  if (m) return `${m[1]}er${m[2] ?? ""}`;
  m = /^([a-z]+)l(ed|er|ers|ing)$/.exec(w);
  if (m && L_DOUBLING_STEMS.has(m[1])) return m[1] + m[2];
  return w;
}

/** Possible base forms of an inflected word ("asked" -> "ask", "cities" -> "city"). */
export function inflectionStems(w: string): string[] {
  const out: string[] = [];
  const add = (base: string) => {
    if (base.length >= 3) out.push(base);
  };
  if (w.length < 4 || /\d/.test(w)) return out;
  if (w.endsWith("ies")) add(w.slice(0, -3) + "y");
  else if (w.endsWith("es")) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
  } else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(w.slice(0, -3) + "y");
  else if (w.endsWith("ed")) {
    const base = w.slice(0, -2);
    add(base);
    if (base.length >= 4 && base[base.length - 1] === base[base.length - 2] && !/[aeiouyls]/.test(base[base.length - 1])) {
      add(base.slice(0, -1));
    }
    if (w.length >= 5) {
      const withE = w.slice(0, -1);
      if (withE.length >= 4 && !withE.endsWith("ee")) add(withE);
    }
  }
  return out;
}

const looseCache = new Map<string, string[]>();

/**
 * Keys for inflection-tolerant matching: two words whose looseKeys intersect are the same word
 * up to a regular -s/-es/-ed ending (also through a homophone: "pears" ~ "pairs").
 */
export function looseKeys(norm: string): string[] {
  const cached = looseCache.get(norm);
  if (cached) return cached;
  const keys = new Set<string>();
  if (norm.length >= 3 && !/\d/.test(norm)) {
    const stems = inflectionStems(norm);
    keys.add(`s:${norm}`);
    for (const s of stems) keys.add(`s:${s}`);
    for (const s of stems) {
      const groups = homophoneGroupsOf.get(s);
      if (groups) for (const g of groups) keys.add(`sh:${g}`);
    }
    if (stems.length > 0 || norm.endsWith("s")) {
      const groups = homophoneGroupsOf.get(norm);
      if (groups) for (const g of groups) keys.add(`sh:${g}`);
    }
  }
  const out = [...keys];
  if (looseCache.size > 20000) looseCache.clear();
  looseCache.set(norm, out);
  return out;
}

/** True when one word is a regular inflection of the other ("follow"/"followed", "form"/"forms"). */
export function inflectionEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  const sa = inflectionStems(a);
  const sb = inflectionStems(b);
  if (sa.includes(b) || sb.includes(a)) return true;
  for (const x of sa) if (sb.includes(x)) return true;
  return false;
}

const keyCache = new Map<string, string[]>();

/**
 * Canonical keys of one written or spoken word; two words match when they share a key.
 * Covers homophones, British/American spelling, abbreviations, number words vs digits,
 * ordinals ("3rd" = "third"), percents, currency and clock times ("9:00").
 */
export function wordKeys(raw: string): string[] {
  const cached = keyCache.get(raw);
  if (cached) return cached;
  const norm = normalizeWord(raw);
  const keys = new Set<string>();
  if (norm.length === 0) {
    if (/^[-\u2010-\u2015]+$/.test(raw.trim())) {
      keys.add("w:dash");
      keys.add("w:hyphen");
    }
  } else {
    addNormKeys(norm, keys);
    const clock = /^(\d{1,2}):00\b/.exec(raw.replace(/^[^\d]+/, ""));
    if (clock) keys.add(`n:${Number(clock[1])}`);
  }
  const out = [...keys];
  if (keyCache.size > 20000) keyCache.clear();
  keyCache.set(raw, out);
  return out;
}

function addNormKeys(norm: string, keys: Set<string>) {
  keys.add(`w:${americanize(norm)}`);
  const groups = homophoneGroupsOf.get(norm);
  if (groups) for (const g of groups) keys.add(`h:${g}`);
  if (norm.length > 3 && norm.endsWith("s")) {
    const stemGroups = homophoneGroupsOf.get(norm.slice(0, -1));
    if (stemGroups) for (const g of stemGroups) keys.add(`hs:${g}`);
  }
  const abbr = ABBREVIATIONS[norm];
  if (abbr) for (const full of abbr) keys.add(`w:${full}`);
  for (const r of numberReadings([norm])) keys.add(`n:${r}`);
  const o = ordinal(expandNumberWords([norm]));
  if (o !== null) keys.add(`o:${o}`);
}

function spellingVariants(norm: string): string[] {
  const groups = homophoneGroupsOf.get(norm);
  if (!groups) return [norm];
  const out = new Set([norm]);
  for (const g of groups) for (const w of HOMOPHONE_GROUPS[g]) if (/^[a-z]+$/.test(w)) out.add(w);
  return [...out];
}

/**
 * Canonical keys of a multi-word phrase, e.g. "twenty five" -> 25, "every day" -> "everyday".
 * Joins also try homophone spellings of each part, so "down write" matches "downright".
 */
export function phraseKeys(norms: string[]): string[] {
  const keys = new Set<string>();
  const joined = norms.join("");
  if (joined.length === 0) return [];
  keys.add(`w:${americanize(joined)}`);
  if (norms.length <= 3) {
    let joins = [""];
    for (const part of norms) {
      const next: string[] = [];
      for (const prefix of joins) for (const v of spellingVariants(part)) next.push(prefix + v);
      joins = next.slice(0, 64);
    }
    for (const j of joins) keys.add(`w:${j}`);
  }
  const groups = homophoneGroupsOf.get(joined);
  if (groups) for (const g of groups) keys.add(`h:${g}`);
  for (const r of numberReadings(norms)) keys.add(`n:${r}`);
  const o = ordinal(expandNumberWords(norms));
  if (o !== null) keys.add(`o:${o}`);
  return [...keys];
}

export function keysIntersect(a: readonly string[], b: readonly string[]): boolean {
  for (const x of a) if (b.includes(x)) return true;
  return false;
}

export type MatchStrictness = "lenient" | "strict";

/** Whether two already-normalized words should count as the same spoken word. */
export function normalizedEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 0 || b.length === 0) return false;
  return keysIntersect(wordKeys(a), wordKeys(b));
}

/** Like normalizedEqual, but also accepts regular inflections (recognizers often add or drop -s/-ed). */
export function looselyEqual(a: string, b: string): boolean {
  return normalizedEqual(a, b) || inflectionEqual(a, b) || homophoneInflection(a, b);
}

function homophoneInflection(a: string, b: string): boolean {
  for (const suffix of ["s", "ed"]) {
    if (a.endsWith(suffix) && b.endsWith(suffix) && a.length > suffix.length + 1 && b.length > suffix.length + 1) {
      const sa = a.slice(0, -suffix.length);
      const sb = b.slice(0, -suffix.length);
      const ga = homophoneGroupsOf.get(sa);
      const gb = homophoneGroupsOf.get(sb);
      if (ga && gb && ga.some((g) => gb.includes(g))) return true;
    }
  }
  return false;
}

export function wordsMatch(target: string, spoken: string, strictness: MatchStrictness): boolean {
  if (strictness === "strict") return target === spoken;
  return keysIntersect(wordKeys(target), wordKeys(spoken));
}

/** True when a multi-word spoken phrase equals a single target (e.g. "twenty five" -> "25"). */
export function phraseMatchesWord(targetNorm: string, spokenNorms: string[]): boolean {
  return keysIntersect(wordKeys(targetNorm), phraseKeys(spokenNorms));
}

/**
 * Chrome sometimes abandons an interim hypothesis without ever finalizing it and starts a
 * fresh one. True when `next` doesn't continue `prev` (different opening words) after a pause,
 * meaning `prev` should be committed instead of discarded.
 */
export function isAbandonedHypothesis(prev: string, next: string, gapMs: number): boolean {
  if (gapMs < 1000) return false;
  const p = prev.split(/\s+/).map(normalizeWord).filter(Boolean);
  const n = next.split(/\s+/).map(normalizeWord).filter(Boolean);
  if (p.length === 0 || n.length === 0) return false;
  const k = Math.min(p.length, n.length, 3);
  let same = 0;
  for (let i = 0; i < k; i++) {
    if (normalizedEqual(p[i], n[i]) || similarity(p[i], n[i]) >= 0.5) same++;
  }
  return same * 2 < k;
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

/** Rough consonant skeleton, so accent-driven vowel changes don't dominate a comparison. */
function consonantSkeleton(w: string): string {
  return w
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/[aeiouyhw]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * True when one recognized word is a sound-alike of two adjacent target words run together,
 * e.g. "into face" -> "interface" or "tell form" -> "teleform". Chrome's language model
 * does this a lot with random word lists, even though both words were spoken.
 */
export function soundsLikeJoin(token: string, a: string, b: string): boolean {
  if (token.length < 6 || a.length < 2 || b.length < 2) return false;
  const joined = a + b;
  if (joined.length < 6 || token[0] !== a[0]) return false;
  if (!/^[a-z]+$/.test(token) || !/^[a-z]+$/.test(joined)) return false;
  const s = similarity(token, joined);
  const score = Math.max(s, (s + similarity(consonantSkeleton(token), consonantSkeleton(joined))) / 2);
  return score >= 0.75 && s > similarity(token, a) && s > similarity(token, b);
}

/** similarity(a, b) >= 0.5, with a cheap length check first. */
export function isSimilar(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  if (max === 0) return true;
  if (Math.abs(a.length - b.length) * 2 > max) return false;
  return levenshtein(a, b) * 2 <= max;
}
