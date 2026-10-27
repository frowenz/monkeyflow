/* Wrapper around the Web Speech API that turns each browser's result stream into one
 * transcript and keeps listening until stop():
 * - Chrome ends continuous sessions after silence or ~60s; Safari 14.1-16 and older
 *   Android Chrome end them after every phrase.
 * - Android Chrome up to ~M130 reports every partial hypothesis as an isFinal result with
 *   confidence 0, each repeating the text before it, then repeats the real final.
 * - Safari keeps every final in the list and its Siri transcripts can repeat finalized
 *   text; with on-device recognition (iOS 18+) the transcript restarts after a pause
 *   without ever being finalized.
 * - Brave/Opera expose the API without a service ('network'); iOS browsers other than
 *   Safari and in-app web views expose it but refuse ('service-not-allowed'). */

import { similarity } from "./normalize";

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

export interface SpeechQuirks {
  /** Chrome, Samsung Internet or a web view on Android. */
  android: boolean;
  /** WebKit's Siri-backed recognizer: Safari on macOS, and every browser on iOS/iPadOS. */
  webkit: boolean;
  ios: boolean;
  /** A browser where the API is exposed but usually refused: iOS browsers other than Safari, in-app web views. */
  embedded: boolean;
  /** A second getUserMedia capture starves the recognizer (Android) or is muted by it (iOS). */
  exclusiveMic: boolean;
}

export function detectSpeechQuirks(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  maxTouchPoints: number = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0,
): SpeechQuirks {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const webkit = ios || (/AppleWebKit/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua));
  const embedded =
    (ios && (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|LinkedInApp|Line\/|Twitter/.test(ua) || !/Safari\//.test(ua))) ||
    (android && /; wv\)/.test(ua));
  return { android, webkit, ios, embedded, exclusiveMic: android || ios };
}

function splitWords(text: string): string[] {
  const t = text.trim();
  return t ? t.split(/\s+/) : [];
}

function wordKey(word: string): string {
  const k = word.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return k || word.toLowerCase();
}

function hasPrefix(keys: string[], prefix: string[]): boolean {
  if (prefix.length > keys.length) return false;
  for (let i = 0; i < prefix.length; i++) if (keys[i] !== prefix[i]) return false;
  return true;
}

/** True when `next` revises or extends `prev` rather than starting a new phrase. */
function continues(prev: string[], next: string[]): boolean {
  const k = Math.min(prev.length, next.length, 3);
  if (k === 0) return true;
  let same = 0;
  for (let i = 0; i < k; i++) {
    const a = wordKey(prev[i]);
    const b = wordKey(next[i]);
    if (a === b || similarity(a, b) >= 0.5) same++;
  }
  return same * 2 >= k;
}

interface RawResult {
  words: string[];
  final: boolean;
  /** Android's pre-M131 partial hypothesis: flagged final, but superseded by the next result. */
  provisional: boolean;
}

interface Segment {
  words: string[];
  keys: string[];
  stable: number;
  provisional: boolean;
  inserted?: boolean;
}

interface Insert {
  anchor: number;
  words: string[];
}

function readResults(results: AnyRecognition, quirks: SpeechQuirks): RawResult[] {
  const out: RawResult[] = [];
  for (let i = 0; i < (results?.length ?? 0); i++) {
    const result = results[i];
    const alt = result?.[0];
    const words = splitWords(alt?.transcript ?? "");
    const provisional = quirks.android && !!result?.isFinal && !((alt?.confidence ?? 0) > 0);
    out.push({ words, final: !!result?.isFinal && !provisional, provisional });
  }
  return out;
}

/**
 * Collapses a result list into one transcript. A result that repeats the whole previous
 * result as its prefix replaces it (cumulative transcripts), Android's provisional results
 * replace each other, and interim hypotheses the recognizer abandoned are re-inserted.
 * Returns the words and how many leading words are final.
 */
function buildTranscript(
  list: RawResult[],
  inserts: Insert[],
  minPrefix: number,
): { words: string[]; stable: number } {
  const segs: Segment[] = [];
  const add = (words: string[], stable: number, provisional: boolean, inserted = false) => {
    const keys = words.map(wordKey);
    const prev = segs[segs.length - 1];
    // A recognizer that re-delivers an abandoned hypothesis repeats it as a prefix.
    const min = prev?.inserted ? 1 : minPrefix;
    if (prev && prev.words.length >= min && hasPrefix(keys, prev.keys)) {
      segs[segs.length - 1] = { words, keys, stable: Math.max(stable, prev.stable), provisional, inserted };
    } else if (prev && prev.provisional && prev.stable < prev.words.length && continues(prev.words, words)) {
      segs[segs.length - 1] = { words, keys, stable, provisional, inserted };
    } else {
      segs.push({ words, keys, stable, provisional, inserted });
    }
  };
  const end = inserts.reduce((m, ins) => Math.max(m, ins.anchor), list.length);
  for (let i = 0; i <= end; i++) {
    for (const ins of inserts) if (ins.anchor === i) add(ins.words, ins.words.length, false, true);
    const r = list[i];
    if (r && r.words.length) add(r.words, r.final ? r.words.length : 0, r.provisional);
  }
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].provisional) segs[i].stable = segs[i].words.length;
  }
  const words: string[] = [];
  let stable = 0;
  let open = true;
  for (const seg of segs) {
    if (open) {
      stable += seg.stable;
      open = seg.stable === seg.words.length;
    }
    words.push(...seg.words);
  }
  return { words, stable };
}

export type RecognizerState = "off" | "starting" | "listening";

export interface RecognizerEvents {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onState: (state: RecognizerState) => void;
  onError: (error: string, message: string) => void;
  onActivity: () => void;
  /** The recognizer detected speech (fires late on Safari, with the first hypothesis). */
  onSpeechStart?: (at: number) => void;
  /** Non-fatal status worth telling the user, e.g. waiting to come back online. */
  onNotice?: (message: string) => void;
}

export interface RecognizerOptions {
  quirks?: SpeechQuirks;
}

/** Errors that will not go away by restarting the session. */
const FATAL = new Set(["not-allowed", "service-not-allowed", "language-not-supported", "bad-grammar", "phrases-not-supported"]);
const MAX_FAILURES = 4;
/** An interim that a different hypothesis replaces after this long was abandoned, not revised. */
const ABANDON_GAP_MS = 1000;
const ERROR_END_TIMEOUT_MS = 2000;
const START_TIMEOUT_MS = 5000;
const EMBEDDED_START_TIMEOUT_MS = 8000;

interface Session {
  rec: AnyRecognition;
  startedAt: number;
  started: boolean;
  heard: boolean;
  error: string | null;
  offline: boolean;
  /** Transcript (final + interim) as of the latest result event. */
  words: string[];
  /** Leading words of `words` that are final. */
  stable: number;
  /** Final words already passed to onFinal. */
  delivered: number;
  /** Words heard before the last reset(); they belong to the previous test. */
  skip: number;
  inserts: Insert[];
  /** Latest interim hypothesis, kept to notice when the recognizer abandons it. */
  tail: { anchor: number; words: string[]; at: number } | null;
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function hasUserActivation(): boolean {
  const ua = typeof navigator !== "undefined" ? (navigator as { userActivation?: { isActive: boolean } }).userActivation : undefined;
  return ua ? ua.isActive : true;
}

export class Recognizer {
  private session: Session | null = null;
  private wanted = false;
  private generation = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Consecutive sessions that failed with a retryable error. */
  private failures = 0;
  /** Consecutive sessions that ended within a second without hearing anything. */
  private quickEnds = 0;
  private everStarted = false;
  private everHeard = false;
  private startedWithGesture = true;
  private pausedWhileHidden = false;
  private waitingOnline = false;
  private listening = false;
  private readonly quirks: SpeechQuirks;
  private readonly minPrefix: number;
  /** Recent recognizer activity, exposed for debugging via window.monkeyflow.state(). */
  readonly log: string[] = [];

  private trace(entry: string) {
    this.log.push(`${Math.round(performance.now())} ${entry}`);
    if (this.log.length > 40) this.log.shift();
  }
  lang = "en-US";

  private events: RecognizerEvents;

  constructor(events: RecognizerEvents, options: RecognizerOptions = {}) {
    this.events = events;
    this.quirks = options.quirks ?? detectSpeechQuirks();
    // Desktop Chrome's results never overlap, so only treat a long repeat as cumulative there.
    this.minPrefix = this.quirks.android || this.quirks.webkit ? 1 : 3;
  }

  get active(): boolean {
    return this.wanted;
  }

  /** Must run synchronously inside the click/keydown handler: Safari only prompts from a user gesture. */
  start(): void {
    if (!getRecognitionCtor()) {
      this.events.onError("unsupported", "Your browser doesn't support built-in speech recognition. Try Chrome, Edge or Safari, or dictate with Wispr Flow.");
      return;
    }
    this.wanted = true;
    this.failures = 0;
    this.quickEnds = 0;
    this.pausedWhileHidden = false;
    this.waitingOnline = false;
    this.startedWithGesture = hasUserActivation();
    this.listen(true);
    this.spawn(true);
  }

  stop(): void {
    this.wanted = false;
    this.pausedWhileHidden = false;
    this.waitingOnline = false;
    this.clearTimers();
    this.discard();
    this.listen(false);
    this.events.onInterim("");
    this.events.onState("off");
  }

  /**
   * Starts a fresh transcript (e.g. on test restart) without restarting the
   * session, which would drop the first ~half second of speech. Results heard
   * so far are ignored; words added later to the still-open result count.
   */
  reset(): void {
    const s = this.session;
    this.trace(`reset wanted=${this.wanted} seen=${s?.words.length ?? 0}`);
    if (!this.wanted) return;
    if (s) s.skip = s.words.length;
    this.events.onInterim("");
  }

  private clearTimers() {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.restartTimer = null;
    this.watchdog = null;
  }

  /** Drops the current session without delivering anything more from it. */
  private discard() {
    this.generation++;
    const rec = this.session?.rec;
    this.session = null;
    try {
      rec?.abort();
    } catch {
      /* already stopped */
    }
  }

  private listen(on: boolean) {
    if (on === this.listening) return;
    this.listening = on;
    const doc = typeof document !== "undefined" ? document : null;
    const win = typeof window !== "undefined" && typeof window.addEventListener === "function" ? window : null;
    if (on) {
      doc?.addEventListener("visibilitychange", this.onVisibility);
      win?.addEventListener("online", this.onOnline);
    } else {
      doc?.removeEventListener("visibilitychange", this.onVisibility);
      win?.removeEventListener("online", this.onOnline);
    }
  }

  private onVisibility = () => {
    if (isHidden() || !this.wanted || !this.pausedWhileHidden) return;
    this.trace("visible: resume");
    this.pausedWhileHidden = false;
    this.spawn(true);
  };

  private onOnline = () => {
    if (!this.wanted || !this.waitingOnline) return;
    this.trace("online: resume");
    this.waitingOnline = false;
    this.spawn(true);
  };

  private scheduleRestart(delay: number) {
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.spawn(delay > 0);
    }, delay);
  }

  private spawn(announce: boolean): void {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !this.wanted) return;
    this.clearTimers();
    this.discard();
    const gen = this.generation;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;
    rec.maxAlternatives = 1;
    const s: Session = {
      rec,
      startedAt: performance.now(),
      started: false,
      heard: false,
      error: null,
      offline: false,
      words: [],
      stable: 0,
      delivered: 0,
      skip: 0,
      inserts: [],
      tail: null,
    };
    this.session = s;
    if (announce) this.events.onState("starting");
    const live = () => gen === this.generation;

    const onStarted = () => {
      if (live()) this.markStarted(s);
    };
    rec.onstart = onStarted;
    rec.onaudiostart = onStarted;
    rec.onspeechstart = () => {
      if (live()) this.events.onSpeechStart?.(performance.now());
    };
    rec.onresult = (e: AnyRecognition) => {
      if (live()) this.handleResult(s, e.results);
    };
    rec.onerror = (e: AnyRecognition) => {
      if (live()) this.handleError(s, String(e?.error ?? "unknown"));
    };
    rec.onend = () => {
      this.trace(`end gen=${gen}/${this.generation} wanted=${this.wanted}`);
      if (live()) this.handleEnd(s);
    };

    try {
      rec.start();
    } catch (err) {
      this.trace(`start threw ${(err as Error)?.name ?? err}`);
      if (++this.failures > MAX_FAILURES) this.fail("start-timeout");
      else this.scheduleRestart(300);
      return;
    }
    this.trace(`spawn gen=${gen}`);
    this.armStartWatchdog(s);
  }

  /** Recovers sessions that never start: Safari can hang silently, in-app web views never prompt. */
  private armStartWatchdog(s: Session) {
    if (this.everStarted) {
      this.watchdog = setTimeout(() => {
        if (this.session !== s || s.started || s.heard) return;
        this.trace("start timeout");
        this.retry(s, "start-timeout");
      }, START_TIMEOUT_MS);
    } else if (this.quirks.embedded) {
      this.watchdog = setTimeout(() => {
        if (this.session !== s || s.started || s.heard) return;
        this.fail("service-not-allowed");
      }, EMBEDDED_START_TIMEOUT_MS);
    }
  }

  private markStarted(s: Session) {
    if (s.started) return;
    s.started = true;
    this.everStarted = true;
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
    this.events.onState("listening");
  }

  private handleResult(s: Session, results: AnyRecognition) {
    this.markStarted(s);
    const now = performance.now();
    const list = readResults(results, this.quirks);
    this.trackTail(s, list, now);
    const { words, stable } = buildTranscript(list, s.inserts, this.minPrefix);
    s.words = words;
    s.stable = stable;
    s.heard = true;
    this.everHeard = true;
    this.failures = 0;
    this.quickEnds = 0;

    const from = Math.max(s.delivered, s.skip);
    if (stable > from) this.events.onFinal(words.slice(from, stable).join(" "));
    if (this.session !== s) return;
    s.delivered = Math.max(s.delivered, stable);
    const interim = words.slice(Math.max(stable, s.skip, s.delivered)).join(" ");
    this.trace(`result final=${stable} words=${words.length} interim="${interim}" skip=${s.skip}`);
    this.events.onInterim(interim);
    this.events.onActivity();
  }

  /**
   * Chrome sometimes, and Safari's on-device recognizer after every pause, replaces an
   * interim hypothesis with a new one without finalizing it. Keep the abandoned words by
   * re-inserting them where they were, which also keeps the reset() word count valid.
   */
  private trackTail(s: Session, list: RawResult[], now: number) {
    let anchor = 0;
    while (anchor < list.length && (list[anchor].final || list[anchor].provisional)) anchor++;
    const tail: string[] = [];
    for (let i = anchor; i < list.length; i++) if (!list[i].final && !list[i].provisional) tail.push(...list[i].words);
    const prev = s.tail;
    if (prev && prev.anchor !== anchor) {
      s.tail = null;
    } else if (prev && tail.length && now - prev.at >= ABANDON_GAP_MS && !continues(prev.words, tail)) {
      this.trace(`abandoned "${prev.words.join(" ")}"`);
      s.inserts.push({ anchor, words: prev.words });
    }
    if (tail.length) s.tail = { anchor, words: tail, at: now };
  }

  private handleError(s: Session, code: string) {
    this.trace(`error ${code}`);
    s.error = code;
    if (code === "no-speech" || code === "aborted") {
      this.awaitEnd(s);
      return;
    }
    // Phones revoke the mic when the page is backgrounded and WebKit refuses to start while hidden.
    if (isHidden() && (code === "not-allowed" || code === "audio-capture" || code === "network")) {
      this.pausedWhileHidden = true;
      this.awaitEnd(s);
      return;
    }
    if (code === "network" && isOffline()) {
      s.offline = true;
      this.awaitEnd(s);
      return;
    }
    if (FATAL.has(code)) {
      this.fail(code);
      return;
    }
    this.failures++;
    if (this.failures > MAX_FAILURES) {
      this.fail(code);
      return;
    }
    this.awaitEnd(s);
  }

  /** Every browser should fire `end` after an error; Edge has been seen not to. */
  private awaitEnd(s: Session) {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (this.session !== s) return;
      this.trace("no end after error");
      this.handleEnd(s);
    }, ERROR_END_TIMEOUT_MS);
  }

  private retry(s: Session, reason: string) {
    this.failures++;
    if (this.failures > MAX_FAILURES) {
      this.fail(reason);
      return;
    }
    this.handleEnd(s);
  }

  private handleEnd(s: Session) {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
    // Sessions can end mid-hypothesis (Safari, Chrome's time limit): keep what was heard.
    const from = Math.max(s.delivered, s.skip);
    if (s.words.length > from) this.events.onFinal(s.words.slice(from).join(" "));
    if (this.session !== s) return;
    s.delivered = Math.max(s.delivered, s.words.length);
    this.discard();
    this.events.onInterim("");
    if (!this.wanted) {
      this.events.onState("off");
      return;
    }
    if (isHidden() || this.pausedWhileHidden) {
      this.trace("hidden: pause");
      this.pausedWhileHidden = true;
      return;
    }
    if (s.offline) {
      this.trace("offline: wait");
      this.waitingOnline = true;
      this.events.onNotice?.("You're offline. Speech recognition will resume when you reconnect.");
      return;
    }
    if (!s.heard && performance.now() - s.startedAt < 1000) this.quickEnds++;
    const backoff = this.quickEnds >= 3 ? Math.min(4000, 250 * 2 ** (this.quickEnds - 3)) : 0;
    this.scheduleRestart(Math.max(this.failures * 250, backoff));
  }

  private fail(code: string) {
    this.trace(`fatal ${code}`);
    this.wanted = false;
    this.pausedWhileHidden = false;
    this.waitingOnline = false;
    this.clearTimers();
    this.discard();
    this.listen(false);
    this.events.onInterim("");
    this.events.onError(code, this.message(code));
    this.events.onState("off");
  }

  private message(code: string): string {
    const q = this.quirks;
    switch (code) {
      case "not-allowed":
        if (!this.everStarted && !this.startedWithGesture) return "Click the mic or press Enter to start listening.";
        return q.ios
          ? "Microphone or speech recognition access was blocked. Allow both for this site (aA > Website Settings in Safari), then tap the mic again."
          : "Microphone access was blocked. Allow it in your browser's site settings.";
      case "service-not-allowed":
        if (q.embedded && q.ios) return "Speech recognition only works in Safari on iPhone and iPad. Open this page in Safari, or dictate with Wispr Flow.";
        if (q.embedded) return "Speech recognition doesn't work in this app's built-in browser. Open the page in Chrome, or dictate with Wispr Flow.";
        if (q.webkit) return "Safari's speech recognition is turned off. Turn on Dictation (or Siri) in your device settings and try again.";
        return "Speech recognition isn't allowed in this browser.";
      case "audio-capture":
        return "Couldn't hear your microphone. Check that it's connected and not in use by another app.";
      case "network":
        if (!this.everHeard) {
          return "This browser's speech recognition service isn't available (Brave, Opera and some other Chromium browsers don't include one). Try Chrome, Edge or Safari, or dictate with Wispr Flow.";
        }
        return "Lost the connection to the speech recognition service. Check your connection and turn the mic back on.";
      case "language-not-supported":
        return "This language isn't supported by your browser's recognizer.";
      case "start-timeout":
        return "Speech recognition stopped responding. Turn the mic off and on again, or reload the page.";
      default:
        return `Speech recognition error: ${code}`;
    }
  }
}
