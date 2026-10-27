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
      this.events.onError("unsupported", "Your browser doesn't support built-in speech recognition. Try Chrome, Edge or Safari, or switch to flow mode.");
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

  /** Drops any in-flight hypothesis (e.g. on test restart) and keeps listening. */
  reset(): void {
    if (!this.wanted) return;
    this.generation++;
    const rec = this.rec;
    this.rec = null;
    try {
      rec?.abort();
    } catch {
      /* noop */
    }
    this.events.onInterim("");
    this.clearRestart();
    this.restartTimer = window.setTimeout(() => this.spawn(), 60);
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
    this.events.onState("starting");

    rec.onstart = () => {
      if (gen !== this.generation) return;
      this.events.onState("listening");
    };

    rec.onresult = (e: AnyRecognition) => {
      if (gen !== this.generation) return;
      this.failures = 0;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript: string = result[0]?.transcript ?? "";
        if (result.isFinal) {
          if (transcript.trim()) this.events.onFinal(transcript.trim());
        } else {
          interim += transcript;
        }
      }
      this.events.onInterim(interim.trim());
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
