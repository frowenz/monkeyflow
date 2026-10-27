import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DEFAULT_CONFIG, useConfig, type Config } from "../store/config";
import { useTest } from "../store/test";
import { notify } from "../store/ui";
import { OFF_ON } from "./components/options";
import { OptionButtons, SettingRow } from "./components/SettingRow";
import { ThemePicker } from "./components/ThemePicker";
import "../styles/pages.css";

interface SettingSpec {
  id: string;
  icon: string;
  title: string;
  description: string;
  note?: ReactNode;
  keywords?: string;
  control?: ReactNode;
  wide?: boolean;
  extra?: ReactNode;
}

interface GroupSpec {
  id: string;
  icon: string;
  title: string;
  settings: SettingSpec[];
}

const SPEECH_LANGS = ["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en-NZ", "en-ZA"];

const restartTest = () => useTest.getState().newTest();

function exportSettings() {
  const state = useConfig.getState();
  const out: Partial<Config> = {};
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    (out as Record<string, unknown>)[key] = state[key];
  }
  const json = JSON.stringify(out);
  navigator.clipboard?.writeText(json).then(
    () => notify("Settings JSON copied to clipboard", "success"),
    () => window.prompt("Copy your settings:", json),
  );
}

function importSettings() {
  const raw = window.prompt("Paste your settings JSON:");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
      if (key in parsed && typeof parsed[key] === typeof DEFAULT_CONFIG[key]) patch[key] = parsed[key];
    }
    useConfig.getState().patch(patch as Partial<Config>);
    restartTest();
    notify("Settings imported", "success");
  } catch {
    notify("That doesn't look like valid settings JSON", "error");
  }
}

function clearResults() {
  if (!window.confirm("Delete all results and personal bests saved on this device? You can't undo this!")) return;
  localStorage.removeItem("monkeyflow-results");
  localStorage.removeItem("monkeyflow-pbs");
  notify("Local results cleared", "success");
}

function resetSettings() {
  if (!window.confirm("Reset all settings to their defaults? You can't undo this!")) return;
  useConfig.getState().reset();
  restartTest();
  notify("Settings reset", "success");
}

async function testMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    notify("This browser can't access a microphone.", "error");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const label = stream.getAudioTracks()[0]?.label;
    stream.getTracks().forEach((t) => t.stop());
    notify(label ? `Microphone ready: ${label}` : "Microphone ready", "success");
  } catch {
    notify("Microphone access was blocked. Allow it in your browser's site settings.", "error");
  }
}

const UNDO_NOTE = <div className="note">You can't undo this!</div>;

const GROUPS: GroupSpec[] = [
  {
    id: "voice",
    icon: "fas fa-microphone-alt",
    title: "voice",
    settings: [
      {
        id: "engine",
        icon: "fas fa-microphone",
        title: "voice engine",
        description:
          "Auto uses your browser's speech recognition and lights words up as you say them. If Wispr Flow (or any dictation app) types into the test, it takes over automatically and your mic only keeps time. Wispr flow only skips the browser's recognition entirely.",
        keywords: "wispr flow dictation builtin speech recognition",
        control: (
          <OptionButtons
            setting="engine"
            after={restartTest}
            options={[
              { value: "builtin", label: "auto" },
              { value: "flow", label: "wispr flow only" },
            ]}
          />
        ),
      },
      {
        id: "speechLang",
        icon: "fas fa-language",
        title: "speech language",
        description:
          "The accent the built-in speech recognition listens for. Pick the one closest to the way you speak for the best accuracy.",
        keywords: "accent locale english",
        wide: true,
        control: <OptionButtons setting="speechLang" options={SPEECH_LANGS.map((l) => ({ value: l, label: l }))} />,
      },
      {
        id: "strictness",
        icon: "fas fa-spell-check",
        title: "match strictness",
        description:
          'Lenient ignores case and punctuation, and accepts homophones like there / their and spoken numbers like "four" for 4. Strict only accepts an exact match.',
        keywords: "lenient strict homophones numbers",
        control: (
          <OptionButtons
            setting="strictness"
            options={[
              { value: "lenient", label: "lenient" },
              { value: "strict", label: "strict" },
            ]}
          />
        ),
      },
      {
        id: "voiceCommands",
        icon: "fas fa-comment-dots",
        title: "voice commands",
        description:
          'Say "next" or "again" on the results screen to start a new test or repeat the last one, hands-free.',
        keywords: "next again hands free",
        control: <OptionButtons setting="voiceCommands" options={OFF_ON} />,
      },
      {
        id: "showTranscript",
        icon: "fas fa-closed-captioning",
        title: "show transcript",
        description: "Shows what the speech recognition heard below the words while you talk (built-in engine only).",
        keywords: "captions heard",
        control: <OptionButtons setting="showTranscript" options={OFF_ON} />,
      },
    ],
  },
  {
    id: "behavior",
    icon: "fas fa-tools",
    title: "behavior",
    settings: [
      {
        id: "language",
        icon: "fas fa-globe-americas",
        title: "language",
        description:
          "Change the word set used for tests. English uses the 200 most common English words, english 1k expands that to the 1000 most common.",
        keywords: "words english 1k word set",
        control: (
          <OptionButtons
            setting="language"
            after={restartTest}
            options={[
              { value: "english", label: "english" },
              { value: "english_1k", label: "english 1k" },
            ]}
          />
        ),
      },
    ],
  },
  {
    id: "caret",
    icon: "fas fa-i-cursor",
    title: "caret",
    settings: [
      {
        id: "smoothCaret",
        icon: "fas fa-i-cursor",
        title: "smooth caret",
        description: "When enabled, the caret will glide smoothly to the next word as you speak instead of jumping.",
        keywords: "animation",
        control: <OptionButtons setting="smoothCaret" options={OFF_ON} />,
      },
    ],
  },
  {
    id: "appearance",
    icon: "fas fa-palette",
    title: "appearance",
    settings: [
      {
        id: "smoothLineScroll",
        icon: "fas fa-align-left",
        title: "smooth line scroll",
        description: "When enabled, the line transition will be animated.",
        keywords: "animation scroll",
        control: <OptionButtons setting="smoothLineScroll" options={OFF_ON} />,
      },
      {
        id: "liveSpeed",
        icon: "fas fa-tachometer-alt",
        title: "live speed",
        description: "Displays a live speed during the test. Updates once every second.",
        keywords: "wpm",
        control: (
          <OptionButtons
            setting="liveSpeed"
            options={[
              { value: "off", label: "off" },
              { value: "mini", label: "mini" },
            ]}
          />
        ),
      },
      {
        id: "liveAcc",
        icon: "fas fa-percentage",
        title: "live accuracy",
        description: "Displays live accuracy during the test.",
        keywords: "acc",
        control: (
          <OptionButtons
            setting="liveAcc"
            options={[
              { value: "off", label: "off" },
              { value: "mini", label: "mini" },
            ]}
          />
        ),
      },
      {
        id: "timerStyle",
        icon: "fas fa-clock",
        title: "timer",
        description:
          "Displays a live timer for timed tests and a word count for word based tests (words, quote or custom mode).",
        keywords: "progress time",
        control: (
          <OptionButtons
            setting="timerStyle"
            options={[
              { value: "off", label: "off" },
              { value: "mini", label: "mini" },
            ]}
          />
        ),
      },
      {
        id: "flipTestColors",
        icon: "fas fa-adjust",
        title: "flip test colors",
        description:
          "By default, spoken words are brighter than the words still ahead. When enabled, the colors will be flipped and the upcoming words will be brighter instead.",
        keywords: "colors contrast",
        control: <OptionButtons setting="flipTestColors" options={OFF_ON} />,
      },
      {
        id: "colorfulMode",
        icon: "fas fa-fill-drip",
        title: "colorful mode",
        description:
          "When enabled, the test words will use the main color instead of the text color, making the website more colorful.",
        keywords: "colors",
        control: <OptionButtons setting="colorfulMode" options={OFF_ON} />,
      },
    ],
  },
  {
    id: "theme",
    icon: "fas fa-brush",
    title: "theme",
    settings: [
      {
        id: "themePicker",
        icon: "fas fa-palette",
        title: "theme",
        description:
          "Completely change the look and feel of the website by picking one of the presets. Star a theme to pin it to the top.",
        keywords: "colors preset dark light",
        control: (
          <div className="optionButtons cols2">
            <button type="button" className="button active">
              preset
            </button>
            <button type="button" className="button" onClick={() => notify("Custom themes are coming soon.", "notice")}>
              custom
            </button>
          </div>
        ),
        extra: <ThemePicker />,
      },
    ],
  },
  {
    id: "dangerZone",
    icon: "fas fa-exclamation-triangle",
    title: "danger zone",
    settings: [
      {
        id: "importExport",
        icon: "fas fa-cogs",
        title: "import/export settings",
        description: "Import or export the settings as JSON.",
        keywords: "backup json",
        control: (
          <div className="optionButtons">
            <button type="button" className="button" onClick={importSettings}>
              import
            </button>
            <button type="button" className="button" onClick={exportSettings}>
              export
            </button>
          </div>
        ),
      },
      {
        id: "clearResults",
        icon: "fas fa-trash-alt",
        title: "clear local results",
        description:
          "Deletes every result and personal best saved on this device, emptying the leaderboard and about page stats.",
        note: UNDO_NOTE,
        keywords: "delete history personal best",
        control: (
          <button type="button" className="button danger wideButton" onClick={clearResults}>
            clear results
          </button>
        ),
      },
      {
        id: "resetSettings",
        icon: "fas fa-undo",
        title: "reset settings",
        description: "Resets settings to the default (but doesn't touch your saved results).",
        note: UNDO_NOTE,
        keywords: "default",
        control: (
          <button type="button" className="button danger wideButton" onClick={resetSettings}>
            reset settings
          </button>
        ),
      },
    ],
  },
];

const ALL_IDS = new Set(GROUPS.flatMap((g) => [`group_${g.id}`, ...g.settings.map((s) => s.id)]));

function matches(spec: SettingSpec, query: string): boolean {
  if (!query) return true;
  return `${spec.title} ${spec.description} ${spec.keywords ?? ""}`.toLowerCase().includes(query);
}

function SettingsGroup({
  group,
  settings,
  forceOpen,
  highlight,
}: {
  group: GroupSpec;
  settings: SettingSpec[];
  forceOpen: boolean;
  highlight: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const animateOpen = useRef(false);
  const open = forceOpen || !collapsed;

  const toggle = () => {
    const el = bodyRef.current;
    if (forceOpen || !el) return;
    if (!collapsed) {
      el.style.overflow = "hidden";
      const anim = el.animate([{ height: `${el.offsetHeight}px` }, { height: "0px" }], {
        duration: 250,
        easing: "ease-in-out",
      });
      anim.onfinish = () => {
        el.style.overflow = "";
        setCollapsed(true);
      };
    } else {
      animateOpen.current = true;
      setCollapsed(false);
    }
  };

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!animateOpen.current || !el) return;
    animateOpen.current = false;
    el.style.overflow = "hidden";
    const anim = el.animate([{ height: "0px" }, { height: `${el.offsetHeight}px` }], {
      duration: 250,
      easing: "ease-in-out",
    });
    anim.onfinish = () => {
      el.style.overflow = "";
    };
  }, [collapsed]);

  return (
    <div id={`group_${group.id}`} className="settingsGroup">
      <button type="button" className={`groupHeader ${open ? "" : "collapsed"}`} onClick={toggle} aria-expanded={open}>
        <span className="chevron">
          <i className="fas fa-chevron-down" />
        </span>
        {group.title}
      </button>
      <div ref={bodyRef} className={`groupBody ${open ? "" : "collapsed"}`}>
        {settings.map((s) => (
          <SettingRow
            key={s.id}
            id={s.id}
            icon={s.icon}
            title={s.title}
            description={
              s.note ? (
                <>
                  {s.description}
                  {s.note}
                </>
              ) : (
                s.description
              )
            }
            control={s.control}
            wide={s.wide}
            extra={s.extra}
            highlighted={highlight === s.id}
          />
        ))}
      </div>
    </div>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SettingsPage() {
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const query = search.trim().toLowerCase();

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || !ALL_IDS.has(id)) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: id.startsWith("group_") ? "start" : "center" });
      if (!id.startsWith("group_")) setHighlight(id);
    });
    const timeout = window.setTimeout(() => setHighlight(null), 1500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, []);

  const visibleGroups = GROUPS.map((g) => ({ group: g, settings: g.settings.filter((s) => matches(s, query)) })).filter(
    (g) => g.settings.length > 0,
  );

  return (
    <main className="page pageSettings">
      <nav className="groupJump">
        {GROUPS.map((g) => (
          <a
            key={g.id}
            href={`#group_${g.id}`}
            onClick={(e) => {
              e.preventDefault();
              scrollToId(`group_${g.id}`);
            }}
          >
            <i className={g.icon} />
            {g.title}
          </a>
        ))}
      </nav>

      <div className="settingsTip">
        tip: You can also change all these settings quickly using the command line
        <br />( <kbd>escape</kbd>&nbsp;or&nbsp;<kbd>ctrl + shift + p</kbd> )
      </div>

      <div className="settingsNotice">
        <i className="fas fa-microphone-alt noticeIcon" />
        <div>
          Monkey Flow needs your microphone. It streams your voice to your browser's speech recognition - or, when
          Wispr Flow is doing the typing, only listens to time you.
        </div>
        <button type="button" className="button noticeButton" onClick={testMicrophone}>
          test microphone
        </button>
      </div>

      <div className="settingsSearch">
        <i className="fas fa-search" />
        <input
          type="text"
          className="input"
          placeholder="search settings"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="settingsGroups">
        {visibleGroups.map(({ group, settings }) => (
          <SettingsGroup
            key={group.id}
            group={group}
            settings={settings}
            forceOpen={query.length > 0}
            highlight={highlight}
          />
        ))}
        {visibleGroups.length === 0 && <div className="settingsEmpty">no settings match "{search.trim()}"</div>}
      </div>
    </main>
  );
}
