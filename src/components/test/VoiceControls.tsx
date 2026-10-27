import { useEffect, useRef, type ReactNode } from "react";
import { useConfig } from "../../store/config";
import { useTest } from "../../store/test";
import { subscribeLevel, toggleListening, useVoice } from "../../store/voice";

export function refocusInput() {
  requestAnimationFrame(() => document.getElementById("wordsInput")?.focus());
}

export function MicButton({ className = "" }: { className?: string }) {
  const listening = useVoice((s) => s.listening);
  const recognizer = useVoice((s) => s.recognizer);
  const dictation = useTest((s) => s.dictation);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      subscribeLevel((level) => {
        ringRef.current?.style.setProperty("--level", level.toFixed(3));
      }),
    [],
  );

  const starting = listening && !dictation && recognizer === "starting";

  return (
    <button
      type="button"
      id="micButton"
      className={`textButton ${listening ? "listening" : ""} ${starting ? "starting" : ""} ${className}`}
      aria-label={listening ? "stop listening" : "start listening"}
      data-balloon-pos="left"
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
  const speechText = useTest((s) => s.speechText);
  const dictation = useTest((s) => s.dictation);
  const listening = useVoice((s) => s.listening);
  const showTranscript = useConfig((s) => s.showTranscript);

  const heard = speechText.split(/\s+/).slice(-12).join(" ");

  let hint: ReactNode = null;
  if (status === "idle") {
    hint = listening ? (
      <>
        <span className="listeningDot" />
        {dictation ? "mic on - dictate with wispr flow" : "listening - start reading"}
      </>
    ) : (
      <>
        <kbd>enter</kbd> or click the mic, then read out loud
      </>
    );
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
      {showTranscript && !dictation && (
        <div className={`transcript ${listening && status === "active" && (heard || interim) ? "" : "hidden"}`}>
          <span className="final">{heard}</span> <span className="interim">{interim}</span>
        </div>
      )}
    </div>
  );
}
