import { useEffect, useRef } from "react";
import { useConfig } from "../../store/config";
import { useTest } from "../../store/test";
import { subscribeLevel, toggleListening, useVoice } from "../../store/voice";

export function refocusInput() {
  requestAnimationFrame(() => document.getElementById("wordsInput")?.focus());
}

export function MicButton({ className = "" }: { className?: string }) {
  const listening = useVoice((s) => s.listening);
  const recognizer = useVoice((s) => s.recognizer);
  const engine = useConfig((s) => s.engine);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      subscribeLevel((level) => {
        ringRef.current?.style.setProperty("--level", level.toFixed(3));
      }),
    [],
  );

  const starting = listening && engine === "builtin" && recognizer === "starting";
  const label = listening
    ? "stop listening"
    : engine === "flow"
      ? "start mic (times your wispr flow dictation)"
      : "start listening";

  return (
    <button
      type="button"
      id="micButton"
      className={`textButton ${listening ? "listening" : ""} ${starting ? "starting" : ""} ${className}`}
      aria-label={label}
      data-balloon-pos="down"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        toggleListening();
        refocusInput();
      }}
    >
      <span className="micRing" ref={ringRef} />
      <i className="fas fa-microphone fa-fw" />
    </button>
  );
}

export function VoiceControls() {
  const status = useTest((s) => s.status);
  const interim = useTest((s) => s.interimText);
  const lastTokens = useTest((s) => s.tokens);
  const listening = useVoice((s) => s.listening);
  const engine = useConfig((s) => s.engine);
  const showTranscript = useConfig((s) => s.showTranscript);

  const heard = lastTokens
    .slice(-12)
    .filter((t) => !t.interim)
    .map((t) => t.text)
    .join(" ");

  let hint: string | null = null;
  if (status === "idle") {
    if (engine === "builtin") hint = listening ? "listening... start reading" : "click the mic or press enter, then read the words out loud";
    else hint = listening ? "mic on - hold your wispr flow key and read" : "focus here and dictate with wispr flow - turn on the mic for accurate timing";
  }

  return (
    <div className="testControls">
      <div className="testButtons">
        <MicButton />
        <button
          type="button"
          id="restartTestButton"
          className="textButton"
          aria-label="Restart Test"
          data-balloon-pos="down"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            useTest.getState().newTest();
            refocusInput();
          }}
        >
          <i className="fas fa-redo-alt fa-fw" />
        </button>
      </div>
      <div className={`voiceHint ${hint ? "" : "hidden"}`}>{hint ?? "\u00a0"}</div>
      {showTranscript && engine === "builtin" && (
        <div className={`transcript ${listening && status === "active" && (heard || interim) ? "" : "hidden"}`}>
          <span className="final">{heard}</span> <span className="interim">{interim}</span>
        </div>
      )}
    </div>
  );
}
