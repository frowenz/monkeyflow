import { create } from "zustand";
import { MicMonitor } from "../lib/mic";
import { normalizeWord } from "../lib/normalize";
import { speechLangFor } from "../lib/words";
import { isSpeechSupported, Recognizer, type RecognizerEvents, type RecognizerState } from "../lib/speech";
import { getConfig, useConfig } from "./config";
import { useTest } from "./test";
import { notify } from "./ui";

interface VoiceState {
  listening: boolean;
  recognizer: RecognizerState;
  micReady: boolean;
  supported: boolean;
  lastHeard: string;
  /** Mic access was refused; shown in place of the start hint until it works. */
  blocked: boolean;
  /** Has this visitor ever turned the mic on (drives the first-visit mic pulse). */
  everUsed: boolean;
}

export const useVoice = create<VoiceState>(() => ({
  listening: false,
  recognizer: "off",
  micReady: false,
  supported: typeof window !== "undefined" ? isSpeechSupported() : false,
  lastHeard: "",
  blocked: false,
  everUsed: typeof localStorage !== "undefined" && localStorage.getItem("monkeyflow-mic-used") === "1",
}));

const levelListeners = new Set<(level: number) => void>();
export function subscribeLevel(cb: (level: number) => void): () => void {
  levelListeners.add(cb);
  return () => levelListeners.delete(cb);
}

const NEXT_WORDS = new Set(["next", "continue", "go", "another", "new", "restart", "start"]);
const REPEAT_WORDS = new Set(["again", "retry", "repeat", "redo"]);
let commandArmedAt = 0;
let commandFired = false;

function handleCommand(text: string): void {
  if (!getConfig().voiceCommands || commandFired) return;
  if (performance.now() - commandArmedAt < 700) return;
  const words = text.split(/\s+/).map(normalizeWord);
  const test = useTest.getState();
  if (words.some((w) => REPEAT_WORDS.has(w))) {
    commandFired = true;
    test.newTest({ repeat: true });
  } else if (words.some((w) => NEXT_WORDS.has(w))) {
    commandFired = true;
    test.newTest();
  }
}

const recognizerHandlers: RecognizerEvents = {
  onInterim: (text) => {
    const test = useTest.getState();
    if (test.status === "finished") {
      if (text) handleCommand(text);
      return;
    }
    test.setInterim(text);
  },
  onFinal: (text) => {
    const test = useTest.getState();
    useVoice.setState({ lastHeard: text });
    if (test.status === "finished") {
      handleCommand(text);
      return;
    }
    test.commitSpeech(text);
  },
  onState: (state) => useVoice.setState({ recognizer: state }),
  onError: (code, message) => {
    if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
      useVoice.setState({ blocked: true });
    }
    notify(message, "error");
    stopListening();
  },
  onActivity: () => {
    // with the mic meter running, voice activity timing comes from the audio itself
    if (!useVoice.getState().micReady) useTest.getState().noteVoiceActivity(performance.now());
  },
};

const recognizer = new Recognizer(recognizerHandlers);

let lastActivityPush = 0;
const mic = new MicMonitor({
  onLevel: (level) => {
    levelListeners.forEach((cb) => cb(level));
    const now = performance.now();
    if (mic.isSpeakingRecently(0) && now - lastActivityPush > 120) {
      lastActivityPush = now;
      useTest.getState().noteVoiceActivity(now);
    }
  },
  onVoiceStart: (at) => useTest.getState().noteVoiceStart(at),
});

export async function startListening(): Promise<void> {
  const { engine, speechLang, language } = getConfig();
  const builtin = engine === "builtin" && isSpeechSupported();
  if (engine === "builtin" && !builtin) {
    notify(
      "This browser has no built-in speech recognition. Dictate with Wispr Flow (or use Chrome, Edge or Safari) - your mic will keep time.",
      "notice",
    );
  }
  useTest.getState().setDictation(!builtin);
  useVoice.setState({ listening: true, blocked: false, everUsed: true });
  localStorage.setItem("monkeyflow-mic-used", "1");
  if (builtin) {
    recognizer.lang = speechLangFor(language, speechLang);
    recognizer.start();
  }
  try {
    await mic.start();
    useVoice.setState({ micReady: true });
  } catch (err) {
    useVoice.setState({ micReady: false });
    if ((err as DOMException)?.name === "NotAllowedError" && !builtin) {
      useVoice.setState({ blocked: true });
      stopListening();
      return;
    }
    if (!builtin) {
      notify("Couldn't access the microphone, so the timer will start when text arrives.", "notice");
    }
  }
  if (!useVoice.getState().listening) mic.stop();
}

let dictationNoticeShown = false;

/** Text was pasted into the test by a dictation app: let it own transcription, keep the mic for timing. */
export function onDictationDetected(): void {
  const test = useTest.getState();
  if (test.dictation) return;
  test.setDictation(true);
  const wasTranscribing = recognizer.active;
  if (wasTranscribing) recognizer.stop();
  test.clearSpeech();
  if (dictationNoticeShown) return;
  dictationNoticeShown = true;
  notify(
    useVoice.getState().listening
      ? "Wispr Flow detected - it's doing the typing now, your mic just keeps time."
      : "Wispr Flow detected. Turn on the mic so the timer starts when you start talking.",
    "notice",
  );
}

export function stopListening(): void {
  recognizer.stop();
  mic.stop();
  useVoice.setState({ listening: false, recognizer: "off", micReady: false });
}

const MIC_KEY = "monkeyflow-mic";

export function toggleListening(): void {
  if (useVoice.getState().listening) {
    const test = useTest.getState();
    if (getConfig().mode === "zen" && test.status === "active") test.finish();
    stopListening();
    localStorage.removeItem(MIC_KEY);
  } else {
    localStorage.setItem(MIC_KEY, "1");
    void startListening();
  }
}

/** Returning visitors who left the mic on get a warm recognizer before they start talking. */
export async function resumeListeningIfAllowed(): Promise<void> {
  if (localStorage.getItem(MIC_KEY) !== "1" || useVoice.getState().listening) return;
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (status.state !== "granted") return;
  } catch {
    return;
  }
  await startListening();
  const resume = () => {
    mic.resumeAudio();
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
}

/** Feeds text through the same path as live recognition (interim words, then finals). */
async function simulateSpeech(text: string, wpm = 170): Promise<void> {
  const words = text.split(/\s+/).filter(Boolean);
  const msPerWord = 60000 / wpm;
  const handlers = recognizerHandlers;
  useTest.getState().noteVoiceStart(performance.now());
  let pending: string[] = [];
  for (let i = 0; i < words.length; i++) {
    pending.push(words[i]);
    handlers.onInterim(pending.join(" "));
    handlers.onActivity();
    await new Promise((r) => setTimeout(r, msPerWord));
    if (pending.length >= 4 + Math.floor(Math.random() * 4) || i === words.length - 1) {
      handlers.onFinal(pending.join(" "));
      handlers.onInterim("");
      pending = [];
    }
  }
}

declare global {
  interface Window {
    monkeyflow?: {
      speak: (text: string, wpm?: number) => Promise<void>;
      speakTest: (wpm?: number, accuracy?: number) => Promise<void>;
      state: () => unknown;
    };
  }
}

async function withSimulatedMic<T>(fn: () => Promise<T>): Promise<T> {
  useVoice.setState({ listening: true, recognizer: "listening" });
  let level = 0.4;
  const id = window.setInterval(() => {
    level = Math.min(0.95, Math.max(0.15, level + (Math.random() - 0.5) * 0.35));
    levelListeners.forEach((cb) => cb(level));
  }, 60);
  try {
    return await fn();
  } finally {
    clearInterval(id);
    levelListeners.forEach((cb) => cb(0));
  }
}

window.monkeyflow = {
  speak: (text, wpm) => withSimulatedMic(() => simulateSpeech(text, wpm)),
  speakTest: (wpm, accuracy) => withSimulatedMic(() => speakTest(wpm, accuracy)),
  state: () => {
    const s = useTest.getState();
    return {
      status: s.status,
      inputText: s.inputText,
      interimText: s.interimText,
      words: s.targets.map((t, i) => [t, s.alignment.words[i]?.status ?? "-", s.alignment.words[i]?.input ?? ""]),
      extras: s.alignment.extras,
      result: s.result && { wpm: s.result.wpm, acc: s.result.acc, time: s.result.time },
      recognizer: { active: recognizer.active, state: useVoice.getState().recognizer, log: recognizer.log.slice(-15) },
    };
  },
};

async function speakTest(wpm = 170, accuracy = 0.97): Promise<void> {
  const testId = useTest.getState().testId;
  const msPerWord = 60000 / wpm;
  useTest.getState().noteVoiceStart(performance.now());
  let index = useTest.getState().alignment.caretWord;
  let pending: string[] = [];
  while (useTest.getState().testId === testId && useTest.getState().status !== "finished") {
    const targets = useTest.getState().targets;
    const target = targets[index++];
    if (target === undefined) break;
    const roll = Math.random();
    if (roll <= accuracy) pending.push(target);
    else if (roll > accuracy + (1 - accuracy) / 2) pending.push(targets[(index * 7) % targets.length]);
    recognizerHandlers.onInterim(pending.join(" "));
    recognizerHandlers.onActivity();
    await new Promise((r) => setTimeout(r, msPerWord * (0.75 + Math.random() * 0.5)));
    if (pending.length >= 4 + Math.floor(Math.random() * 4)) {
      recognizerHandlers.onFinal(pending.join(" "));
      recognizerHandlers.onInterim("");
      pending = [];
    }
  }
  if (pending.length && useTest.getState().testId === testId) recognizerHandlers.onFinal(pending.join(" "));
}

let lastTestId = useTest.getState().testId;
let lastStatus = useTest.getState().status;
useTest.subscribe((state) => {
  if (state.testId !== lastTestId) {
    lastTestId = state.testId;
    commandFired = false;
    recognizer.reset();
  }
  if (state.status !== lastStatus) {
    if (state.status === "finished") {
      commandArmedAt = performance.now();
      commandFired = false;
      recognizer.reset();
    }
    lastStatus = state.status;
  }
});

let lastEngine = getConfig().engine;
let lastLang = speechLangFor(getConfig().language, getConfig().speechLang);
useConfig.subscribe((c) => {
  const lang = speechLangFor(c.language, c.speechLang);
  if (c.engine === lastEngine && lang === lastLang) return;
  lastEngine = c.engine;
  lastLang = lang;
  if (useVoice.getState().listening) {
    stopListening();
    void startListening();
  }
});
