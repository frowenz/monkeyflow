/* Thin wrapper around the Web Speech API that survives Chrome's habit of
 * ending continuous sessions after silence or ~60 seconds. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function getRecognitionCtor(): (new () => AnyRecognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => AnyRecognition)
    | null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && getRecognitionCtor() !== null;
}

function splitWords(text: string): string[] {
  const t = text.trim();
  return t ? t.split(/\s+/) : [];
}

export type RecognizerState = "off" | "starting" | "listening";

export interface RecognizerEvents {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onState: (state: RecognizerState) => void;
  onError: (error: string, message: string) => void;
  onActivity: () => void;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser.",
  "audio-capture": "No microphone found.",
  network: "Speech recognition needs a network connection.",
  "language-not-supported": "This language isn't supported by your browser's recognizer.",
};

export class Recognizer {
  private rec: AnyRecognition | null = null;
  private wanted = false;
  private generation = 0;
  private restartTimer: number | null = null;
  private failures = 0;
  /** Words heard this session (final + interim) as of the latest result event. */
  private seenWords = 0;
  /** Final words already passed to onFinal this session. */
  private deliveredWords = 0;
  /** Words heard before the last reset(); they belong to the previous test. */
  private skipWords = 0;
  /** Recent recognizer activity, exposed for debugging via window.monkeyflow.state(). */
  readonly log: string[] = [];

  private trace(entry: string) {
    this.log.push(`${Math.round(performance.now())} ${entry}`);
    if (this.log.length > 40) this.log.shift();
  }
  lang = "en-US";

  private events: RecognizerEvents;

  constructor(events: RecognizerEvents) {
    this.events = events;
  }

  get active(): boolean {
    return this.wanted;
  }

  start(): void {
    if (!getRecognitionCtor()) {
      this.events.onError("unsupported", "Your browser doesn't support built-in speech recognition. Try Chrome, Edge or Safari, or dictate with Wispr Flow.");
      return;
    }
    this.wanted = true;
    this.failures = 0;
    this.spawn();
  }

  stop(): void {
    this.wanted = false;
    this.clearRestart();
    this.generation++;
    const rec = this.rec;
    this.rec = null;
    try {
      rec?.abort();
    } catch {
      /* already stopped */
    }
    this.events.onInterim("");
    this.events.onState("off");
  }

  /**
   * Starts a fresh transcript (e.g. on test restart) without restarting the
   * session, which would drop the first ~half second of speech. Results heard
   * so far are ignored; words added later to the still-open result count.
   */
  reset(): void {
    this.trace(`reset wanted=${this.wanted} seen=${this.seenWords}`);
    if (!this.wanted) return;
    this.skipWords = this.seenWords;
    this.events.onInterim("");
  }

  private clearRestart() {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private spawn(): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !this.wanted) return;
    this.clearRestart();
    const gen = ++this.generation;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 1;
    this.rec = rec;
    this.seenWords = 0;
    this.deliveredWords = 0;
    this.skipWords = 0;
    this.events.onState("starting");

    rec.onstart = () => {
      if (gen !== this.generation) return;
      this.events.onState("listening");
    };

    // Chrome re-segments interim results as it finalizes them, so track progress
    // by word counts across the whole session transcript rather than result indices.
    rec.onresult = (e: AnyRecognition) => {
      if (gen !== this.generation) return;
      this.failures = 0;
      const finals: string[] = [];
      const interims: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        const text = (result[0]?.transcript ?? "").trim();
        if (text) (result.isFinal ? finals : interims).push(text);
      }
      const finalWords = splitWords(finals.join(" "));
      const interimWords = splitWords(interims.join(" "));
      this.seenWords = finalWords.length + interimWords.length;
      const from = Math.max(this.deliveredWords, this.skipWords);
      if (finalWords.length > from) this.events.onFinal(finalWords.slice(from).join(" "));
      this.deliveredWords = Math.max(this.deliveredWords, finalWords.length);
      const interim = interimWords.slice(Math.max(0, this.skipWords - finalWords.length)).join(" ");
      this.trace(`result final=${finalWords.length} interim="${interim}" skip=${this.skipWords}`);
      this.events.onInterim(interim);
      this.events.onActivity();
    };

    rec.onerror = (e: AnyRecognition) => {
      if (gen !== this.generation) return;
      const code: string = e.error;
      if (code === "no-speech" || code === "aborted") return;
      if (FRIENDLY_ERRORS[code] && code !== "network") {
        this.wanted = false;
        this.events.onError(code, FRIENDLY_ERRORS[code]);
        this.events.onState("off");
        return;
      }
      this.failures++;
      if (this.failures > 4) {
        this.wanted = false;
        this.events.onError(code, FRIENDLY_ERRORS[code] ?? `Speech recognition error: ${code}`);
        this.events.onState("off");
      }
    };

    rec.onend = () => {
      this.trace(`end gen=${gen}/${this.generation} wanted=${this.wanted}`);
      if (gen !== this.generation) return;
      this.events.onInterim("");
      if (this.wanted) {
        this.restartTimer = window.setTimeout(() => this.spawn(), this.failures ? 250 * this.failures : 0);
      } else {
        this.events.onState("off");
      }
    };

    try {
      rec.start();
    } catch {
      this.restartTimer = window.setTimeout(() => this.spawn(), 300);
    }
  }
}
