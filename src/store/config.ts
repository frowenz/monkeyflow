import { create } from "zustand";
import type { MatchStrictness } from "../lib/normalize";
import type { Language, QuoteLength } from "../lib/words";

export type Mode = "time" | "words" | "quote" | "zen" | "custom";
export type Engine = "builtin" | "flow";
export type LiveStat = "off" | "mini" | "text";
export type PaceCaret = "off" | "pb" | "custom";

export interface Config {
  mode: Mode;
  time: number;
  words: number;
  quoteLength: QuoteLength;
  punctuation: boolean;
  numbers: boolean;
  language: Language;
  engine: Engine;
  theme: string;
  strictness: MatchStrictness;
  smoothCaret: boolean;
  paceCaret: PaceCaret;
  paceCaretWpm: number;
  smoothLineScroll: boolean;
  liveSpeed: LiveStat;
  liveAcc: LiveStat;
  timerStyle: LiveStat;
  showTranscript: boolean;
  voiceCommands: boolean;
  speechLang: string;
  customText: string;
  fontSize: number;
  flipTestColors: boolean;
  colorfulMode: boolean;
}

export const DEFAULT_CONFIG: Config = {
  mode: "time",
  time: 30,
  words: 25,
  quoteLength: "all",
  punctuation: false,
  numbers: false,
  language: "english",
  engine: "builtin",
  theme: "serika dark",
  strictness: "lenient",
  smoothCaret: true,
  paceCaret: "off",
  paceCaretWpm: 150,
  smoothLineScroll: true,
  liveSpeed: "off",
  liveAcc: "off",
  timerStyle: "mini",
  showTranscript: true,
  voiceCommands: true,
  speechLang: "en-US",
  customText:
    "The quick brown fox jumps over the lazy dog. Speaking is so much faster than typing, and now you can prove it.",
  fontSize: 2,
  flipTestColors: false,
  colorfulMode: false,
};

const STORAGE_KEY = "monkeyflow-config";

function load(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

interface ConfigStore extends Config {
  set: <K extends keyof Config>(key: K, value: Config[K]) => void;
  patch: (partial: Partial<Config>) => void;
  reset: () => void;
}

export const useConfig = create<ConfigStore>((set) => ({
  ...load(),
  set: (key, value) => set({ [key]: value } as Partial<ConfigStore>),
  patch: (partial) => set(partial),
  reset: () => set(DEFAULT_CONFIG),
}));

useConfig.subscribe((state) => {
  const out: Partial<Config> = {};
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    (out as Record<string, unknown>)[key] = state[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
});

export function getConfig(): Config {
  return useConfig.getState();
}
