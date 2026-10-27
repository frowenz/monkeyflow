import { useEffect, useRef, useState } from "react";
import { useConfig } from "../../store/config";
import { useTest } from "../../store/test";
import { useUi } from "../../store/ui";
import { isTouchDevice } from "../../lib/device";
import { onDictationDetected, useVoice } from "../../store/voice";
import { ResultPage } from "../result/ResultPage";
import { TestConfig } from "../TestConfig";
import { LiveStats } from "./LiveStats";
import { refocusInput, VoiceControls } from "./VoiceControls";
import { Words } from "./Words";

function LanguageButton() {
  const language = useConfig((s) => s.language);
  const status = useTest((s) => s.status);

  return (
    <div className={`testTopRow ${status === "active" ? "hidden" : ""}`}>
      <button
        type="button"
        className="textButton languageButton"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => useUi.getState().openCommandLine("language")}
      >
        <i className="fas fa-globe-americas" />
        {language.replace("_", " ")}
      </button>
    </div>
  );
}

function TestView() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputText = useTest((s) => s.inputText);
  const status = useTest((s) => s.status);
  const testId = useTest((s) => s.testId);
  const modalOpen = useUi((s) => s.commandLineOpen || s.customTextOpen);
  const listening = useVoice((s) => s.listening);
  const [focused, setFocused] = useState(true);
  const [blurred, setBlurred] = useState(false);
  const touch = isTouchDevice();

  useEffect(() => {
    if (!modalOpen && !touch) inputRef.current?.focus();
  }, [modalOpen, testId, touch]);

  useEffect(() => {
    if (focused || modalOpen || listening || touch) {
      setBlurred(false);
      return;
    }
    const id = window.setTimeout(() => setBlurred(true), 1000);
    return () => clearTimeout(id);
  }, [focused, modalOpen, listening, touch]);

  return (
    <div id="typingTest" onClick={() => inputRef.current?.focus()}>
      <LanguageButton />
      <div className="wordsArea">
        <LiveStats />
        <textarea
          id="wordsInput"
          ref={inputRef}
          value={inputText}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          data-1p-ignore=""
          data-lpignore="true"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const test = useTest.getState();
            if (test.status === "finished") return;
            const next = e.target.value.replace(/\n/g, " ");
            // keystrokes insert one character; dictation apps paste whole phrases
            const dictated = next.length - test.inputText.length >= 2;
            if (dictated) onDictationDetected();
            useTest.getState().setInput(next, dictated);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        <Words blurred={blurred} />
        {blurred && status !== "finished" && (
          <div className="outOfFocusWarning">
            <i className="fas fa-mouse-pointer" />
            Click here or press any key to focus
          </div>
        )}
      </div>
      <VoiceControls />
    </div>
  );
}

export function TestPage() {
  const status = useTest((s) => s.status);
  const testId = useTest((s) => s.testId);
  const finished = status === "finished";

  useEffect(() => {
    if (useTest.getState().targets.length === 0) useTest.getState().newTest();
  }, []);

  useEffect(() => {
    if (!finished) refocusInput();
  }, [finished, testId]);

  return (
    <main className={`page pageTest ${finished ? "showingResult" : ""}`}>
      {finished ? <div /> : <TestConfig />}
      {finished ? <ResultPage key={`r${testId}`} /> : <TestView key={`t${testId}`} />}
      <div />
    </main>
  );
}
