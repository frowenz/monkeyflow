import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectSpeechQuirks, Recognizer, type RecognizerState, type SpeechQuirks } from "./speech";

interface FakeResult {
  transcript: string;
  final: boolean;
  confidence: number;
}
const I = (transcript: string): FakeResult => ({ transcript, final: false, confidence: 0 });
const F = (transcript: string, confidence = 0.9): FakeResult => ({ transcript, final: true, confidence });
/** Android Chrome <= M130: a partial hypothesis reported as a final with confidence 0. */
const P = (transcript: string): FakeResult => F(transcript, 0);

type Handler = ((e?: unknown) => void) | null;

class FakeRecognition {
  static all: FakeRecognition[] = [];
  static throwOnStart = false;
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 0;
  onstart: Handler = null;
  onaudiostart: Handler = null;
  onspeechstart: Handler = null;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: Handler = null;
  started = false;
  aborted = false;

  constructor() {
    FakeRecognition.all.push(this);
  }
  start() {
    if (FakeRecognition.throwOnStart) throw new Error("InvalidStateError");
    this.started = true;
  }
  stop() {}
  abort() {
    this.aborted = true;
  }

  fireStart() {
    this.onstart?.();
    this.onaudiostart?.();
  }
  emit(...results: FakeResult[]) {
    const list = results.map((r) => Object.assign([{ transcript: r.transcript, confidence: r.confidence }], { isFinal: r.final }));
    this.onresult?.({ resultIndex: 0, results: list });
  }
  error(code: string) {
    this.onerror?.({ error: code });
  }
  end() {
    this.onend?.();
  }
}

const DESKTOP: SpeechQuirks = { android: false, webkit: false, ios: false, embedded: false, exclusiveMic: false };
const ANDROID: SpeechQuirks = { ...DESKTOP, android: true, exclusiveMic: true };
const SAFARI: SpeechQuirks = { ...DESKTOP, webkit: true };
const IOS_IN_APP: SpeechQuirks = { ...DESKTOP, webkit: true, ios: true, embedded: true, exclusiveMic: true };

let doc: EventTarget & { visibilityState: DocumentVisibilityState };
let win: EventTarget & { webkitSpeechRecognition: typeof FakeRecognition };

function setup(quirks: SpeechQuirks = DESKTOP) {
  const log: string[] = [];
  const finals: string[] = [];
  const states: RecognizerState[] = [];
  const errors: [string, string][] = [];
  const notices: string[] = [];
  let interim = "";
  const rec = new Recognizer(
    {
      onFinal: (t) => {
        finals.push(t);
        log.push(`F:${t}`);
      },
      onInterim: (t) => {
        if (t !== interim) log.push(`I:${t}`);
        interim = t;
      },
      onState: (s) => states.push(s),
      onError: (code, message) => errors.push([code, message]),
      onActivity: () => {},
      onNotice: (m) => notices.push(m),
    },
    { quirks },
  );
  return {
    rec,
    log,
    finals,
    states,
    errors,
    notices,
    interim: () => interim,
    current: () => FakeRecognition.all[FakeRecognition.all.length - 1],
  };
}

beforeEach(() => {
  FakeRecognition.all = [];
  FakeRecognition.throwOnStart = false;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
  win = Object.assign(new EventTarget(), { webkitSpeechRecognition: FakeRecognition });
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("starting", () => {
  it("calls recognition.start() synchronously so Safari sees the user gesture", () => {
    const h = setup();
    h.rec.start();
    expect(FakeRecognition.all).toHaveLength(1);
    const r = h.current();
    expect(r.started).toBe(true);
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    expect(h.states).toEqual(["starting"]);
    r.fireStart();
    expect(h.states).toEqual(["starting", "listening"]);
  });

  it("reports unsupported browsers", () => {
    vi.stubGlobal("window", new EventTarget());
    const h = setup();
    h.rec.start();
    expect(h.errors[0][0]).toBe("unsupported");
    expect(h.rec.active).toBe(false);
  });

  it("retries when start() throws", () => {
    const h = setup();
    FakeRecognition.throwOnStart = true;
    h.rec.start();
    FakeRecognition.throwOnStart = false;
    vi.advanceTimersByTime(300);
    expect(FakeRecognition.all).toHaveLength(2);
    expect(h.current().started).toBe(true);
  });

  it("gives up when start() keeps throwing", () => {
    const h = setup();
    FakeRecognition.throwOnStart = true;
    h.rec.start();
    vi.advanceTimersByTime(300 * 10);
    expect(FakeRecognition.all).toHaveLength(5);
    expect(h.errors.map((e) => e[0])).toEqual(["start-timeout"]);
    expect(h.rec.active).toBe(false);
    expect(h.states.at(-1)).toBe("off");
  });
});

describe("desktop Chrome", () => {
  it("follows interim re-segmentation and merged finals by word count", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.fireStart();
    r.emit(I("the"));
    r.emit(I("the quick"));
    r.emit(F("the quick"), I("brown"));
    r.emit(F("the quick"), I("brown fox"), I("jumps"));
    r.emit(F("the quick"), I("brown"));
    r.emit(F("the quick"), F("brown fox jumps"));
    r.emit(F("the quick"), F("brown fox jumps"), I("over the"));
    r.emit(F("the quick"), F("brown fox jumps"), F("over the lazy dog"));
    expect(h.log).toEqual([
      "I:the",
      "I:the quick",
      "F:the quick",
      "I:brown",
      "I:brown fox jumps",
      "I:brown",
      "F:brown fox jumps",
      "I:",
      "I:over the",
      "F:over the lazy dog",
      "I:",
    ]);
  });

  it("keeps a short phrase repeated across results", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(F("the"));
    h.current().emit(F("the"), F("the cat"));
    expect(h.finals).toEqual(["the", "the cat"]);
  });

  it("delivers finals with zero confidence (Edge reports 0 for everything)", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(F("scroll down", 0));
    expect(h.finals).toEqual(["scroll down"]);
  });

  it("keeps an interim hypothesis Chrome abandons after a pause", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.emit(F("a b"), I("c d"));
    vi.advanceTimersByTime(1500);
    r.emit(F("a b"), I("x y"));
    expect(h.finals).toEqual(["a b", "c d"]);
    expect(h.interim()).toBe("x y");
    r.emit(F("a b"), F("x y z"));
    expect(h.finals).toEqual(["a b", "c d", "x y z"]);
  });

  it("does not treat a quick revision as an abandoned hypothesis", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.emit(I("for score"));
    vi.advanceTimersByTime(300);
    r.emit(I("four score and"));
    r.emit(F("four score and seven"));
    expect(h.finals).toEqual(["four score and seven"]);
  });

  it("delivers an unfinished interim when the session ends (60s limit)", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.emit(F("a b"), I("c d"));
    r.end();
    expect(h.log).toEqual(["F:a b", "I:c d", "F:c d", "I:"]);
    vi.advanceTimersByTime(0);
    expect(FakeRecognition.all).toHaveLength(2);
    h.current().emit(I("e"));
    expect(h.interim()).toBe("e");
  });

  it("restarts silently after silence without flashing the starting state", () => {
    const h = setup();
    h.rec.start();
    h.current().fireStart();
    h.current().error("no-speech");
    h.current().end();
    vi.advanceTimersByTime(0);
    expect(FakeRecognition.all).toHaveLength(2);
    h.current().fireStart();
    expect(h.states.filter((s) => s === "starting")).toHaveLength(1);
    expect(h.errors).toEqual([]);
  });
});

describe("Android Chrome", () => {
  it("collapses cumulative provisional partials and the repeated final", () => {
    const h = setup(ANDROID);
    h.rec.start();
    const r = h.current();
    r.fireStart();
    r.emit(P("hello"));
    r.emit(P("hello"), P("hello this"));
    r.emit(P("hello"), P("hello this"), P("hello the sis"));
    r.emit(P("hello"), P("hello this"), P("hello the sis"), F("hello this is my"));
    r.emit(P("hello"), P("hello this"), P("hello the sis"), F("hello this is my"), F("hello this is my"));
    expect(h.log).toEqual(["I:hello", "I:hello this", "I:hello the sis", "F:hello this is my", "I:"]);

    r.end();
    vi.advanceTimersByTime(0);
    const r2 = h.current();
    expect(r2).not.toBe(r);
    r2.emit(P("name"));
    r2.emit(P("name"), F("name is John"));
    expect(h.finals).toEqual(["hello this is my", "name is John"]);
  });

  it("returns each phrase once when the final is duplicated", () => {
    const h = setup(ANDROID);
    h.rec.start();
    h.current().emit(F("hello world"));
    h.current().emit(F("hello world"), F("hello world"));
    expect(h.finals).toEqual(["hello world"]);
  });

  it("delivers only the new suffix when a final repeats earlier finals", () => {
    const h = setup(ANDROID);
    h.rec.start();
    const r = h.current();
    r.emit(F("a b"));
    r.emit(F("a b"), F("a b c d"));
    r.emit(F("a b"), F("a b c d"), I("a b c d e"));
    expect(h.finals).toEqual(["a b", "c d"]);
    expect(h.interim()).toBe("e");
  });

  it("commits a provisional phrase once a new phrase follows it", () => {
    const h = setup(ANDROID);
    h.rec.start();
    const r = h.current();
    r.emit(P("good morning"));
    r.emit(P("good morning"), P("world peace"));
    expect(h.finals).toEqual(["good morning"]);
    expect(h.interim()).toBe("world peace");
  });

  it("soft-resets mid-utterance", () => {
    const h = setup(ANDROID);
    h.rec.start();
    const r = h.current();
    r.emit(P("next"));
    h.rec.reset();
    r.emit(P("next"), P("next the"));
    r.emit(P("next"), P("next the"), F("next the quick"));
    expect(h.log).toEqual(["I:next", "I:", "I:the", "F:the quick", "I:"]);
  });
});

describe("Safari", () => {
  it("restarts after every phrase without losing words or flashing the starting state", () => {
    const h = setup(SAFARI);
    h.rec.start();
    const r = h.current();
    r.fireStart();
    r.emit(I("Hello"));
    r.emit(I("Hello world"));
    r.emit(F("Hello world."));
    r.end();
    vi.advanceTimersByTime(0);
    const r2 = h.current();
    expect(r2).not.toBe(r);
    r2.fireStart();
    r2.emit(I("How are"));
    r2.emit(F("How are you?"));
    expect(h.log).toEqual(["I:Hello", "I:Hello world", "F:Hello world.", "I:", "I:How are", "F:How are you?", "I:"]);
    expect(h.states).toEqual(["starting", "listening", "listening"]);
  });

  it("strips finalized text that the interim repeats", () => {
    const h = setup(SAFARI);
    h.rec.start();
    const r = h.current();
    r.emit(F("Hello world."));
    r.emit(F("Hello world."), I("hello world how"));
    expect(h.interim()).toBe("how");
    r.emit(F("Hello world."), F("Hello world. How are you?"));
    expect(h.finals).toEqual(["Hello world.", "How are you?"]);
  });

  it("keeps the transcript when on-device recognition restarts it after a pause", () => {
    const h = setup(SAFARI);
    h.rec.start();
    const r = h.current();
    r.emit(I("how are you"));
    vi.advanceTimersByTime(2000);
    r.emit(I("fine"));
    expect(h.finals).toEqual(["how are you"]);
    expect(h.interim()).toBe("fine");
    vi.advanceTimersByTime(300);
    r.emit(I("fine thanks"));
    expect(h.interim()).toBe("fine thanks");
    r.end();
    expect(h.finals).toEqual(["how are you", "fine thanks"]);
  });

  it("does not repeat a restarted phrase when its final arrives", () => {
    const h = setup(SAFARI);
    h.rec.start();
    const r = h.current();
    r.emit(I("how are you"));
    vi.advanceTimersByTime(2000);
    r.emit(I("fine"));
    r.emit(F("fine thanks"));
    expect(h.finals).toEqual(["how are you", "fine thanks"]);
  });

  it("does not swallow new words when the transcript restarts after a soft reset", () => {
    const h = setup(SAFARI);
    h.rec.start();
    const r = h.current();
    r.emit(I("the end of the test"));
    h.rec.reset();
    vi.advanceTimersByTime(1500);
    r.emit(I("next"));
    expect(h.finals).toEqual([]);
    expect(h.interim()).toBe("next");
  });
});

describe("soft reset", () => {
  it("skips words heard before reset() mid-utterance", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.emit(I("next"));
    h.rec.reset();
    r.emit(I("next the"));
    r.emit(F("next the quick"), I("brown"));
    expect(h.log).toEqual(["I:next", "I:", "I:the", "F:the quick", "I:brown"]);
  });

  it("does not deliver pre-reset words when the session ends", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(I("last words"));
    h.rec.reset();
    h.current().end();
    expect(h.finals).toEqual([]);
  });

  it("counts a new session from zero when reset() lands between sessions", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(F("one two"));
    h.current().end();
    h.rec.reset();
    vi.advanceTimersByTime(0);
    h.current().emit(I("three"));
    expect(h.finals).toEqual(["one two"]);
    expect(h.interim()).toBe("three");
  });

  it("is a no-op when not listening", () => {
    const h = setup();
    h.rec.reset();
    expect(h.log).toEqual([]);
  });
});

describe("errors", () => {
  it("backs off on network errors, then explains a missing speech service", () => {
    const h = setup();
    h.rec.start();
    for (let i = 1; i <= 4; i++) {
      h.current().error("network");
      h.current().end();
      vi.advanceTimersByTime(250 * i - 1);
      expect(FakeRecognition.all).toHaveLength(i);
      vi.advanceTimersByTime(1);
      expect(FakeRecognition.all).toHaveLength(i + 1);
    }
    h.current().error("network");
    expect(h.errors).toHaveLength(1);
    expect(h.errors[0][0]).toBe("network");
    expect(h.errors[0][1]).toMatch(/Brave/);
    expect(h.rec.active).toBe(false);
    expect(h.states[h.states.length - 1]).toBe("off");
  });

  it("forgets earlier network errors once results arrive", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(F("hello"));
    for (let i = 0; i < 4; i++) {
      h.current().error("network");
      h.current().end();
      vi.advanceTimersByTime(1000);
    }
    h.current().emit(F("again"));
    h.current().error("network");
    h.current().end();
    expect(h.errors).toEqual([]);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2000);
      h.current().error("network");
      h.current().end();
    }
    expect(h.errors[0][1]).toMatch(/Lost the connection/);
  });

  it("waits for the connection when offline instead of failing", () => {
    vi.stubGlobal("navigator", { userAgent: "", onLine: false });
    const h = setup();
    h.rec.start();
    h.current().error("network");
    h.current().end();
    vi.advanceTimersByTime(10000);
    expect(FakeRecognition.all).toHaveLength(1);
    expect(h.errors).toEqual([]);
    expect(h.notices).toHaveLength(1);
    win.dispatchEvent(new Event("online"));
    expect(FakeRecognition.all).toHaveLength(2);
  });

  it("stops on not-allowed", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.error("not-allowed");
    expect(h.errors).toEqual([["not-allowed", "Microphone access was blocked. Allow it in your browser's site settings."]]);
    expect(r.aborted).toBe(true);
    r.end();
    vi.advanceTimersByTime(5000);
    expect(FakeRecognition.all).toHaveLength(1);
  });

  it("pauses while the page is hidden and resumes when it is visible again", () => {
    const h = setup(SAFARI);
    h.rec.start();
    h.current().fireStart();
    doc.visibilityState = "hidden";
    h.current().error("not-allowed");
    h.current().end();
    vi.advanceTimersByTime(5000);
    expect(FakeRecognition.all).toHaveLength(1);
    expect(h.errors).toEqual([]);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(FakeRecognition.all).toHaveLength(2);
    expect(h.current().started).toBe(true);
  });

  it("explains service-not-allowed in iOS in-app browsers", () => {
    const h = setup(IOS_IN_APP);
    h.rec.start();
    h.current().error("service-not-allowed");
    expect(h.errors[0][1]).toMatch(/Safari/);
  });

  it("gives up on iOS in-app browsers that never start", () => {
    const h = setup(IOS_IN_APP);
    h.rec.start();
    vi.advanceTimersByTime(8000);
    expect(h.errors[0][0]).toBe("service-not-allowed");
  });

  it("retries audio-capture errors (mic briefly taken by another app)", () => {
    const h = setup();
    h.rec.start();
    h.current().error("audio-capture");
    h.current().end();
    vi.advanceTimersByTime(250);
    expect(FakeRecognition.all).toHaveLength(2);
    expect(h.errors).toEqual([]);
  });

  it("restarts when an error is not followed by end", () => {
    const h = setup();
    h.rec.start();
    h.current().emit(I("hi"));
    h.current().error("aborted");
    vi.advanceTimersByTime(2000);
    expect(h.finals).toEqual(["hi"]);
    // fake timers run a 0ms timer scheduled inside a tick 1ms later
    vi.advanceTimersByTime(1);
    expect(FakeRecognition.all).toHaveLength(2);
  });

  it("restarts a session that never starts once permission is known", () => {
    const h = setup();
    h.rec.start();
    h.current().fireStart();
    h.current().end();
    vi.advanceTimersByTime(0);
    expect(FakeRecognition.all).toHaveLength(2);
    vi.advanceTimersByTime(5000);
    expect(FakeRecognition.all[1].aborted).toBe(true);
    vi.advanceTimersByTime(250);
    expect(FakeRecognition.all).toHaveLength(3);
  });

  it("backs off when sessions keep ending immediately", () => {
    const h = setup();
    h.rec.start();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      const n = FakeRecognition.all.length;
      h.current().error("aborted");
      h.current().end();
      let waited = 0;
      while (FakeRecognition.all.length === n) {
        vi.advanceTimersByTime(50);
        waited += 50;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([50, 50, 250, 500, 1000, 2000]);
    expect(h.errors).toEqual([]);
  });
});

describe("stop", () => {
  it("aborts and ignores late events from the old session", () => {
    const h = setup();
    h.rec.start();
    const r = h.current();
    r.emit(I("hello"));
    h.rec.stop();
    expect(r.aborted).toBe(true);
    expect(h.interim()).toBe("");
    expect(h.states[h.states.length - 1]).toBe("off");
    r.emit(F("hello"));
    r.end();
    vi.advanceTimersByTime(5000);
    expect(h.finals).toEqual([]);
    expect(FakeRecognition.all).toHaveLength(1);
  });

  it("can start again after stopping", () => {
    const h = setup();
    h.rec.start();
    h.rec.stop();
    h.rec.start();
    h.current().emit(F("again"));
    expect(h.finals).toEqual(["again"]);
  });
});

describe("detectSpeechQuirks", () => {
  const cases: [string, string, number, Partial<SpeechQuirks>][] = [
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      5,
      { android: true, webkit: false, ios: false, embedded: false, exclusiveMic: true },
    ],
    [
      "Samsung Internet",
      "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      5,
      { android: true, embedded: false },
    ],
    [
      "Android web view",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36",
      5,
      { android: true, embedded: true },
    ],
    [
      "iPhone Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
      5,
      { android: false, webkit: true, ios: true, embedded: false, exclusiveMic: true },
    ],
    [
      "iPhone Chrome",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1",
      5,
      { webkit: true, ios: true, embedded: true },
    ],
    [
      "iPhone in-app browser",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.80",
      5,
      { ios: true, embedded: true },
    ],
    [
      "iPad (desktop UA)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
      5,
      { webkit: true, ios: true, exclusiveMic: true },
    ],
    [
      "macOS Safari",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
      0,
      { webkit: true, ios: false, embedded: false, exclusiveMic: false },
    ],
    [
      "macOS Chrome",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      0,
      DESKTOP,
    ],
    [
      "Windows Edge",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      0,
      DESKTOP,
    ],
    ["Firefox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0", 0, DESKTOP],
  ];
  it.each(cases)("%s", (_name, ua, touch, expected) => {
    expect(detectSpeechQuirks(ua, touch)).toMatchObject(expected);
  });
});
