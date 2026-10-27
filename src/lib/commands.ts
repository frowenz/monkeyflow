import { create } from "zustand";
import { useConfig, type Config, type Engine, type LiveStat, type Mode } from "../store/config";
import { useTest } from "../store/test";
import { useUi, type Page } from "../store/ui";
import { toggleListening } from "../store/voice";
import type { MatchStrictness } from "./normalize";
import { THEMES, type Theme } from "./themes";
import { QUOTES, type Language, type QuoteLength } from "./words";

export interface CommandInput {
  placeholder: string;
  defaultValue?: () => string;
  validate?: (value: string) => boolean;
}

export interface Command {
  id: string;
  display: string;
  icon?: string;
  /** Extra search terms that don't show up in the row. */
  alias?: string;
  subgroup?: () => CommandGroup;
  input?: CommandInput;
  exec?: (input?: string) => void;
  /** Marks the currently selected option of a submenu (renders the check icon). */
  active?: () => boolean;
  /** Theme rows render colour bubbles and live-preview the theme while highlighted. */
  theme?: Theme;
  /** Secondary text rendered on the right of the row. */
  extra?: string;
  /** Subgroup children are listed individually when searching from the root (default true). */
  flatten?: boolean;
}

export interface CommandGroup {
  id: string;
  /** Title of the parent command; doubles as the search placeholder inside the submenu. */
  title: string;
  icon?: string;
  list: Command[];
}

/** A row as displayed by the command line. `parent` is set for flattened root-search rows. */
export interface CommandRow {
  key: string;
  command: Command;
  parent?: CommandGroup;
}

/** Name of the theme the command line is currently live-previewing (null when not previewing). */
export const usePreviewTheme = create<{ name: string | null }>(() => ({ name: null }));

const cfg = () => useConfig.getState();
const restart = () => useTest.getState().newTest();

function patchAndRestart(patch: Partial<Config>) {
  cfg().patch(patch);
  restart();
}

function choiceGroup<K extends keyof Config>(
  id: string,
  title: string,
  icon: string,
  key: K,
  options: { value: Config[K]; display: string; alias?: string }[],
  opts: { restart?: boolean; extraPatch?: Partial<Config> } = {},
): CommandGroup {
  return {
    id,
    title,
    icon,
    list: options.map((o) => ({
      id: `${id}-${String(o.value)}`,
      display: o.display,
      alias: o.alias,
      active: () => cfg()[key] === o.value,
      exec: () => {
        const patch = { ...opts.extraPatch, [key]: o.value } as Partial<Config>;
        if (opts.restart) patchAndRestart(patch);
        else cfg().patch(patch);
      },
    })),
  };
}

type BoolKey = { [K in keyof Config]: Config[K] extends boolean ? K : never }[keyof Config];

function onOffGroup(id: string, title: string, icon: string, key: BoolKey, restartTest = false): CommandGroup {
  return choiceGroup(
    id,
    title,
    icon,
    key,
    [
      { value: false, display: "off" },
      { value: true, display: "on" },
    ],
    { restart: restartTest },
  );
}

function liveStatGroup(id: string, title: string, icon: string, key: "liveSpeed" | "liveAcc" | "timerStyle") {
  const options: { value: LiveStat; display: string }[] = [
    { value: "off", display: "off" },
    { value: "mini", display: "mini" },
  ];
  return choiceGroup(id, title, icon, key, options);
}

function parsePositiveInt(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

/** Accepts plain seconds or "1h30m15s" style durations. */
function parseDuration(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (/^\d+$/.test(v)) return parsePositiveInt(v);
  const m = v.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 ? total : null;
}

const TIMES = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];

const modeGroup = (): CommandGroup =>
  choiceGroup(
    "mode",
    "Mode...",
    "fa-bars",
    "mode",
    (["time", "words", "quote", "zen", "custom"] as Mode[]).map((m) => ({ value: m, display: m })),
    { restart: true },
  );

const timeGroup = (): CommandGroup => ({
  id: "time",
  title: "Time...",
  icon: "fa-clock",
  list: [
    ...TIMES.map<Command>((t) => ({
      id: `time-${t}`,
      display: String(t),
      active: () => cfg().time === t,
      exec: () => patchAndRestart({ mode: "time", time: t }),
    })),
    {
      id: "time-custom",
      display: "custom...",
      input: {
        placeholder: "Custom time (seconds, or 1h30m)",
        defaultValue: () => (TIMES.includes(cfg().time) ? "" : String(cfg().time)),
        validate: (v) => parseDuration(v) !== null,
      },
      exec: (v) => {
        const t = parseDuration(v ?? "");
        if (t !== null) patchAndRestart({ mode: "time", time: t });
      },
    },
  ],
});

const wordsGroup = (): CommandGroup => ({
  id: "words",
  title: "Words...",
  icon: "fa-font",
  list: [
    ...WORD_COUNTS.map<Command>((w) => ({
      id: `words-${w}`,
      display: String(w),
      active: () => cfg().words === w,
      exec: () => patchAndRestart({ mode: "words", words: w }),
    })),
    {
      id: "words-custom",
      display: "custom...",
      input: {
        placeholder: "Custom word amount",
        defaultValue: () => (WORD_COUNTS.includes(cfg().words) ? "" : String(cfg().words)),
        validate: (v) => {
          const n = parsePositiveInt(v);
          return n !== null && n <= 10000;
        },
      },
      exec: (v) => {
        const n = parsePositiveInt(v ?? "");
        if (n !== null) patchAndRestart({ mode: "words", words: n });
      },
    },
  ],
});

const quoteLengthGroup = (): CommandGroup =>
  choiceGroup(
    "quoteLength",
    "Quote length...",
    "fa-quote-right",
    "quoteLength",
    (["all", "short", "medium", "long", "thicc"] as QuoteLength[]).map((q) => ({ value: q, display: q })),
    { restart: true, extraPatch: { mode: "quote" } },
  );

const quotesGroup = (): CommandGroup => ({
  id: "quotes",
  title: "Search quotes...",
  icon: "fa-search",
  list: QUOTES.map<Command>((q) => ({
    id: `quote-${q.id}`,
    display: q.text,
    alias: `${q.source} ${q.id}`,
    extra: q.source,
    active: () => useConfig.getState().mode === "quote" && useTest.getState().quote?.id === q.id,
    exec: () => {
      cfg().patch({ mode: "quote" });
      useTest.getState().newTest({ quoteId: q.id });
    },
  })),
});

const themeGroup = (): CommandGroup => ({
  id: "themes",
  title: "Theme...",
  icon: "fa-palette",
  list: [...THEMES]
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: false }))
    .map<Command>((t) => ({
      id: `theme-${t.name}`,
      display: t.name,
      theme: t,
      active: () => cfg().theme === t.name,
      exec: () => cfg().set("theme", t.name),
    })),
});

const languageGroup = (): CommandGroup =>
  choiceGroup(
    "language",
    "Language...",
    "fa-language",
    "language",
    [
      { value: "english" as Language, display: "english" },
      { value: "english_1k" as Language, display: "english 1k" },
      { value: "tongue_twisters" as Language, display: "tongue twisters", alias: "twister peter piper seashells" },
      { value: "spanish" as Language, display: "spanish", alias: "espanol" },
      { value: "french" as Language, display: "french", alias: "francais" },
      { value: "german" as Language, display: "german", alias: "deutsch" },
      { value: "portuguese" as Language, display: "portuguese", alias: "portugues brasil" },
      { value: "italian" as Language, display: "italian", alias: "italiano" },
    ],
    { restart: true },
  );

const engineGroup = (): CommandGroup =>
  choiceGroup(
    "engine",
    "Voice engine...",
    "fa-microphone",
    "engine",
    [
      { value: "builtin" as Engine, display: "auto", alias: "built-in browser web speech chrome" },
      { value: "flow" as Engine, display: "wispr flow", alias: "dictation" },
    ],
    { restart: true },
  );

const SPEECH_LANGS: { code: string; name: string }[] = [
  { code: "en-US", name: "united states american" },
  { code: "en-GB", name: "united kingdom british" },
  { code: "en-AU", name: "australia" },
  { code: "en-CA", name: "canada" },
  { code: "en-IN", name: "india" },
  { code: "en-NZ", name: "new zealand" },
  { code: "en-ZA", name: "south africa" },
];

const speechLangGroup = (): CommandGroup =>
  choiceGroup(
    "speechLang",
    "Speech language...",
    "fa-globe-americas",
    "speechLang",
    SPEECH_LANGS.map((l) => ({ value: l.code, display: l.code, alias: `accent ${l.name}` })),
  );

const strictnessGroup = (): CommandGroup =>
  choiceGroup(
    "strictness",
    "Match strictness...",
    "fa-spell-check",
    "strictness",
    [
      { value: "lenient" as MatchStrictness, display: "lenient" },
      { value: "strict" as MatchStrictness, display: "strict" },
    ],
  );

function goTo(id: string, display: string, icon: string, page: Page): Command {
  return { id, display, icon, alias: "page navigate", exec: () => useUi.getState().setPage(page) };
}

function sub(id: string, display: string, icon: string, group: () => CommandGroup, alias?: string): Command {
  return { id, display, icon, alias, subgroup: group };
}

/** Groups that can be opened directly via `openCommandLine(initial)`. */
export const GROUPS: Record<string, () => CommandGroup> = {
  themes: themeGroup,
  theme: themeGroup,
  language: languageGroup,
  time: timeGroup,
  words: wordsGroup,
  quotes: quotesGroup,
  quoteLength: quoteLengthGroup,
  mode: modeGroup,
  engine: engineGroup,
  speechLang: speechLangGroup,
};

export function rootGroup(): CommandGroup {
  return {
    id: "root",
    title: "Search...",
    list: [
      sub("punctuation", "Punctuation...", "fa-at", () =>
        onOffGroup("punctuation", "Punctuation...", "fa-at", "punctuation", true),
      ),
      sub("numbers", "Numbers...", "fa-hashtag", () => onOffGroup("numbers", "Numbers...", "fa-hashtag", "numbers", true)),
      sub("mode", "Mode...", "fa-bars", modeGroup),
      sub("time", "Time...", "fa-clock", timeGroup),
      sub("words", "Words...", "fa-font", wordsGroup),
      sub("quoteLength", "Quote length...", "fa-quote-right", quoteLengthGroup),
      { ...sub("quotes", "Search quotes...", "fa-search", quotesGroup, "find quote"), flatten: false },
      sub("language", "Language...", "fa-language", languageGroup),
      {
        id: "customText",
        display: "Change custom text",
        icon: "fa-pen",
        alias: "edit custom text mode",
        exec: () => useUi.getState().setCustomTextOpen(true),
      },
      sub("theme", "Theme...", "fa-palette", themeGroup, "colors colours"),
      sub("engine", "Voice engine...", "fa-microphone", engineGroup, "wispr flow built-in speech recognition"),
      sub("speechLang", "Speech language...", "fa-globe-americas", speechLangGroup, "accent locale"),
      sub("strictness", "Match strictness...", "fa-spell-check", strictnessGroup, "lenient strict"),
      sub(
        "voiceCommands",
        "Voice commands...",
        "fa-comment-dots",
        () => onOffGroup("voiceCommands", "Voice commands...", "fa-comment-dots", "voiceCommands"),
        "next again restart",
      ),
      sub(
        "showTranscript",
        "Show transcript...",
        "fa-closed-captioning",
        () => onOffGroup("showTranscript", "Show transcript...", "fa-closed-captioning", "showTranscript"),
        "interim live text",
      ),
      {
        id: "toggleMic",
        display: "Toggle microphone",
        icon: "fa-microphone-alt",
        alias: "start stop listening voice mic",
        exec: () => toggleListening(),
      },
      sub("paceCaret", "Pace caret...", "fa-tachometer-alt", () =>
        choiceGroup("paceCaret", "Pace caret...", "fa-tachometer-alt", "paceCaret", [
          { value: "off", display: "off" },
          { value: "pb", display: "pb", alias: "personal best ghost race" },
          { value: "custom", display: "custom", alias: "ghost race wpm" },
        ]),
      ),
      sub("paceCaretWpm", "Pace caret speed...", "fa-tachometer-alt", () =>
        choiceGroup(
          "paceCaretWpm",
          "Pace caret speed...",
          "fa-tachometer-alt",
          "paceCaretWpm",
          [100, 150, 200, 250, 300].map((w) => ({ value: w, display: `${w} wpm` })),
          { extraPatch: { paceCaret: "custom" } },
        ),
      ),
      sub("smoothCaret", "Smooth caret...", "fa-i-cursor", () =>
        onOffGroup("smoothCaret", "Smooth caret...", "fa-i-cursor", "smoothCaret"),
      ),
      sub("smoothLineScroll", "Smooth line scroll...", "fa-align-left", () =>
        onOffGroup("smoothLineScroll", "Smooth line scroll...", "fa-align-left", "smoothLineScroll"),
      ),
      sub(
        "liveSpeed",
        "Live speed...",
        "fa-tachometer-alt",
        () => liveStatGroup("liveSpeed", "Live speed...", "fa-tachometer-alt", "liveSpeed"),
        "wpm",
      ),
      sub("liveAcc", "Live accuracy...", "fa-percentage", () =>
        liveStatGroup("liveAcc", "Live accuracy...", "fa-percentage", "liveAcc"),
      ),
      sub(
        "timerStyle",
        "Timer...",
        "fa-stopwatch",
        () => liveStatGroup("timerStyle", "Timer...", "fa-stopwatch", "timerStyle"),
        "progress",
      ),
      sub("flipTestColors", "Flip test colors...", "fa-adjust", () =>
        onOffGroup("flipTestColors", "Flip test colors...", "fa-adjust", "flipTestColors"),
      ),
      sub("colorfulMode", "Colorful mode...", "fa-fill-drip", () =>
        onOffGroup("colorfulMode", "Colorful mode...", "fa-fill-drip", "colorfulMode"),
      ),
      { id: "restart", display: "Restart test", icon: "fa-redo-alt", alias: "new next", exec: restart },
      {
        id: "repeat",
        display: "Repeat test",
        icon: "fa-sync-alt",
        alias: "again same",
        exec: () => useTest.getState().newTest({ repeat: true }),
      },
      goTo("settings", "Go to settings", "fa-cog", "settings"),
      goTo("about", "Go to about", "fa-info", "about"),
      goTo("leaderboards", "Go to leaderboards", "fa-crown", "leaderboards"),
      {
        id: "resetSettings",
        display: "Reset settings",
        icon: "fa-undo-alt",
        alias: "defaults clear",
        exec: () => {
          cfg().reset();
          restart();
          useUi.getState().notify("Settings reset", "success");
        },
      },
    ],
  };
}

export function stripEllipsis(title: string): string {
  return title.replace(/\.\.\.$/, "");
}

function displayText(row: CommandRow): string {
  const c = row.command;
  return (row.parent ? `${stripEllipsis(row.parent.title)} ${c.display}` : c.display).toLowerCase();
}

/**
 * Monkeytype-style matching: every word of the query has to match a word of the command
 * (prefix match). Longer query words also match anywhere inside the text and against the
 * command's aliases, which keeps fragments useful without flooding one-letter queries.
 */
function score(display: string, alias: string, queryWords: string[]): number {
  const words = display.split(/\s+/);
  const aliasWords = alias ? alias.split(/\s+/) : [];
  let total = 0;
  for (const q of queryWords) {
    if (words.some((w) => w.startsWith(q))) total += 3;
    else if (q.length >= 2 && aliasWords.some((w) => w.startsWith(q))) total += 2;
    else if (q.length >= 3 && (display.includes(q) || alias.includes(q))) total += 1;
    else return 0;
  }
  return total;
}

export function filterRows(rows: CommandRow[], query: string): CommandRow[] {
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return rows;
  const scored: { row: CommandRow; s: number; i: number }[] = [];
  rows.forEach((row, i) => {
    const s = score(displayText(row), (row.command.alias ?? "").toLowerCase(), queryWords);
    if (s > 0) scored.push({ row, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.map((x) => x.row);
}

/** Rows for a group. At the root with a query, subgroups are flattened into "Parent > child" rows. */
export function buildRows(group: CommandGroup, query: string, isRoot: boolean): CommandRow[] {
  if (!isRoot || query.trim() === "") {
    return filterRows(
      group.list.map((command) => ({ key: command.id, command })),
      query,
    );
  }
  const flat: CommandRow[] = [];
  for (const command of group.list) {
    if (command.subgroup && command.flatten !== false) {
      const child = command.subgroup();
      for (const c of child.list) flat.push({ key: `${command.id}/${c.id}`, command: c, parent: child });
    } else {
      flat.push({ key: command.id, command });
    }
  }
  return filterRows(flat, query);
}
