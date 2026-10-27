import { create } from "zustand";
import { MicMonitor } from "../lib/mic";
import { normalizeWord } from "../lib/normalize";
import { isSpeechSupported, Recognizer, type RecognizerState } from "../lib/speech";
import { getConfig, useConfig } from "./config";
import { useTest } from "./test";
import { notify } from "./ui";

interface VoiceState {
  listening: boolean;
  recognizer: RecognizerState;
  micReady: boolean;
  supported: boolean;
  lastHeard: string;
}

export const useVoice = create<VoiceState>(() => ({
  listening: false,
  recognizer: "off",
  micReady: false,
  supported: typeof window !== "undefined" ? isSpeechSupported() : false,
  lastHeard: "",
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

const recognizer = new Recognizer({
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
  onError: (_code, message) => {
    notify(message, "error");
    stopListening();
  },
  onActivity: () => {
    useTest.getState().noteVoiceActivity(performance.now());
  },
});

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
  const { engine, speechLang } = getConfig();
  if (engine === "builtin" && !isSpeechSupported()) {
    notify(
      "Built-in speech recognition isn't available in this browser. Use Chrome, Edge or Safari, or switch to flow mode and dictate with Wispr Flow.",
      "error",
    );
    return;
  }
  useVoice.setState({ listening: true });
  try {
    await mic.start();
    useVoice.setState({ micReady: true });
  } catch {
    useVoice.setState({ micReady: false });
    if (engine === "flow") {
      notify("Couldn't access the microphone, so the timer will start when text arrives.", "notice");
    }
  }
  if (!useVoice.getState().listening) {
    mic.stop();
    return;
  }
  if (engine === "builtin") {
    recognizer.lang = speechLang;
    recognizer.start();
  }
}

export function stopListening(): void {
  recognizer.stop();
  mic.stop();
  useVoice.setState({ listening: false, recognizer: "off", micReady: false });
}

export function toggleListening(): void {
  if (useVoice.getState().listening) stopListening();
  else void startListening();
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
let lastLang = getConfig().speechLang;
useConfig.subscribe((c) => {
  if (c.engine === lastEngine && c.speechLang === lastLang) return;
  lastEngine = c.engine;
  lastLang = c.speechLang;
  if (useVoice.getState().listening) {
    stopListening();
    void startListening();
  }
});
