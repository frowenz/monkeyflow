import { lazy, Suspense, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useChallenge } from "../../hooks/useChallengeLink";
import { QUOTE_GROUPS } from "../../lib/words";
import { captureElement, copyImageOrDownload, screenshotFilename } from "../../lib/screenshot";
import {
  AVERAGE_TYPIST_WPM,
  challengeFromResult,
  challengeMatchesResult,
  challengeOutcome,
  challengeUrl,
  compareToTyping,
  copyText,
  loadTypingWpm,
  saveTypingWpm,
  shareText,
  xIntentUrl,
} from "../../lib/share";
import { useConfig } from "../../store/config";
import { useTest, type TestResult } from "../../store/test";
import { notify, useUi } from "../../store/ui";
import { useVoice } from "../../store/voice";
import { LogoIcon } from "../Logo";
import { WordsHistory } from "./WordsHistory";
import "../../styles/result.css";
import { appPath } from "../../lib/base";
import { publicHost } from "../../lib/base";

const ResultChart = lazy(() => import("./ResultChart").then((m) => ({ default: m.ResultChart })));

const countedResults = new Set<number>();
let sessionSeconds = 0;

function addToSession(r: TestResult): number {
  if (!countedResults.has(r.timestamp)) {
    countedResults.add(r.timestamp);
    sessionSeconds += r.time;
  }
  return sessionSeconds;
}

function formatClock(seconds: number): string {
  const s = Math.round(seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function quoteGroup(r: TestResult): string {
  if (r.mode2 !== "all") return r.mode2;
  const len = r.quote?.length ?? 0;
  const entry = Object.entries(QUOTE_GROUPS).find(([, [min, max]]) => len >= min && len <= max);
  return entry?.[0] ?? "";
}

function testTypeLines(r: TestResult): string[] {
  const lines: string[] = [];
  if (r.mode === "time" || r.mode === "words") lines.push(`${r.mode} ${r.mode2}`);
  else if (r.mode === "quote") lines.push(`quote ${quoteGroup(r)}`.trim());
  else lines.push(r.mode);
  lines.push(r.language);
  if (r.mode === "time" || r.mode === "words") {
    if (r.punctuation) lines.push("punctuation");
    if (r.numbers) lines.push("numbers");
  }
  lines.push(r.engine === "flow" ? "wispr flow" : r.engine === "keyboard" ? "keyboard" : "voice");
  return lines;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString("en-US", { month: "short" });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function TypingSpeedPrompt({
  initial,
  autoFocus,
  onSave,
  onCancel,
}: {
  initial: number | null;
  autoFocus: boolean;
  onSave: (wpm: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial === null ? "" : String(initial));
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const n = Number(value);
    if (value && n >= 1) onSave(n);
    else onCancel();
  };

  return (
    <div className="typingPrompt">
      <label htmlFor="typingWpmInput">how fast do you type?</label>
      <input
        id="typingWpmInput"
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => {
          // keep Enter / Escape away from useGlobalKeys (restart, command line)
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commit();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            cancelled.current = true;
            setValue(initial === null ? "" : String(initial));
            onCancel();
            e.currentTarget.blur();
          }
        }}
      />
      <span>wpm</span>
    </div>
  );
}

export function ResultPage() {
  const result = useTest((s) => s.result);
  const historyOpen = useUi((s) => s.wordsHistoryOpen);
  const voiceCommands = useConfig((s) => s.voiceCommands);
  const listening = useVoice((s) => s.listening);
  const challenge = useChallenge((s) => s.challenge);
  const [session] = useState(() => (result ? addToSession(result) : 0));
  const [typingWpm, setTypingWpm] = useState(loadTypingWpm);
  const [editingTyping, setEditingTyping] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const captureDone = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollTo({ top: 0 });
  }, []);

  useLayoutEffect(() => {
    if (capturing && captureDone.current) {
      captureDone.current();
      captureDone.current = null;
    }
  }, [capturing]);

  if (!result) return null;

  const r = result;
  const { correct, incorrect, extra, missed } = r.chars;
  const wrong = incorrect + extra + missed;
  const wpmTooltip =
    `${r.wpm.toFixed(2)} wpm` +
    (!r.isPb && r.previousPb !== null ? `\npersonal best: ${r.previousPb.toFixed(2)} wpm` : "");

  const typing = compareToTyping(r.wpm, typingWpm);
  const typingTooltip = typing.personal
    ? `talking is ${typing.ratio.toFixed(2)}x your typing\nyou type ${typing.typingWpm} wpm`
    : `${typing.ratio.toFixed(2)}x the average typist\n(${AVERAGE_TYPIST_WPM} wpm)`;
  const ownChallenge = challengeFromResult(r);
  const link = challengeUrl(ownChallenge);
  const brag = shareText(r, { typingWpm, link });
  const target = challenge && challenge.wpm !== null && challengeMatchesResult(challenge, r) ? challenge.wpm : null;
  const outcome = target === null ? null : challengeOutcome(target, r);
  const showTypingPrompt = !capturing && !r.invalid && (typingWpm === null || editingTyping);

  const saveTypingSpeed = (wpm: number) => {
    saveTypingWpm(wpm);
    setTypingWpm(wpm);
    setEditingTyping(false);
  };

  const copyChallengeLink = () => {
    copyText(link).then((ok) => {
      if (!ok) notify("Couldn't copy the link", "error");
      else if (ownChallenge) notify("Challenge link copied to clipboard", "success");
      else notify(`Copied link (${r.mode} tests can't be replayed)`, "notice");
    });
  };

  const saveScreenshot = (e: MouseEvent<HTMLButtonElement>) => {
    if (capturing) return;
    const forceDownload = e.shiftKey;
    const root = rootRef.current;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim() || "#323437";
    const ready = new Promise<void>((resolve) => {
      captureDone.current = resolve;
    });
    setLockedHeight(root ? root.offsetHeight : null);
    setCapturing(true);
    const blob = (async () => {
      await ready;
      await nextFrame();
      await nextFrame();
      const target = targetRef.current;
      if (!target) throw new Error("result not mounted");
      return captureElement(target, { backgroundColor: bg });
    })();
    const finish = () => {
      setCapturing(false);
      setLockedHeight(null);
    };
    blob.then(finish, finish);
    copyImageOrDownload(blob, screenshotFilename(r.timestamp), forceDownload, { title: "monkeyflow", text: brag })
      .then((how) => {
        if (how === "copied") notify("Copied to clipboard", "success");
        else if (how === "downloaded") notify("Screenshot downloaded", "success");
      })
      .catch(() => notify("Couldn't save the screenshot", "error"));
  };

  return (
    <div
      id="result"
      ref={rootRef}
      className={capturing ? "capturing" : ""}
      style={lockedHeight ? { minHeight: lockedHeight } : undefined}
      onKeyDown={(e) => {
        // useGlobalKeys sends every Tab to #nextTestButton; once focus is inside the result, let Tab move between controls
        if (e.key === "Tab") e.stopPropagation();
      }}
    >
      <div id="resultScreenshotTarget" ref={targetRef}>
        <div className="resultTop">
          <div className="resultMainStats">
            <div className="group wpm">
              <div className="top">
                <div>wpm</div>
                {r.isPb && (
                  <div className="crown" aria-label="new personal best" data-balloon-pos="up">
                    <i className="fas fa-crown" />
                  </div>
                )}
              </div>
              <div
                className="bottom"
                aria-label={wpmTooltip}
                data-balloon-pos="up"
                {...(wpmTooltip.includes("\n") ? { "data-balloon-break": "" } : {})}
              >
                {Math.round(r.wpm)}
              </div>
              {target !== null && challenge && (
                <div
                  className={`challengeNote ${outcome}`}
                  aria-label={`challenge: ${target} wpm${challenge.acc !== null ? ` · ${challenge.acc}% acc` : ""}`}
                  data-balloon-pos="up"
                >
                  {outcome === "beat" ? (
                    <>
                      you beat <span className="value">{target}</span> wpm!
                    </>
                  ) : outcome === "tied" ? (
                    <>
                      you tied <span className="value">{target}</span> wpm
                    </>
                  ) : (
                    <>
                      <span className="value">{target}</span> wpm to beat
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="group acc">
              <div className="top">acc</div>
              <div
                className="bottom"
                aria-label={`${r.acc.toFixed(2)}%\n${correct} correct\n${wrong} incorrect`}
                data-balloon-pos="up"
                data-balloon-break=""
              >
                {Math.floor(r.acc)}%
              </div>
            </div>
          </div>
          <Suspense fallback={<div className="resultChart" />}>
            <ResultChart result={r} />
          </Suspense>
        </div>

        <div className="resultStats">
          <div className="group testType">
            <div className="top">test type</div>
            <div className="bottom">
              {testTypeLines(r).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
          {r.invalid && (
            <div className="group info">
              <div className="top">other</div>
              <div className="bottom">
                <div>invalid</div>
                <div className="reason">{r.invalid}</div>
              </div>
            </div>
          )}
          <div className="group raw">
            <div className="top">raw</div>
            <div className="bottom" aria-label={`${r.raw.toFixed(2)} wpm`} data-balloon-pos="up">
              {Math.round(r.raw)}
            </div>
          </div>
          <div className="group key">
            <div className="top">characters</div>
            <div className="bottom" aria-label={"correct\nincorrect\nextra\nmissed"} data-balloon-pos="up" data-balloon-break="">
              {correct}/{incorrect}/{extra}/{missed}
            </div>
          </div>
          <div className="group consistency">
            <div className="top">consistency</div>
            <div className="bottom" aria-label={`${r.consistency.toFixed(2)}%`} data-balloon-pos="up">
              {Math.round(r.consistency)}%
            </div>
          </div>
          <div className="group time">
            <div className="top">time</div>
            <div className="bottom" aria-label={`${r.time.toFixed(2)}s`} data-balloon-pos="up">
              <div>{Math.round(r.time)}s</div>
              <div className="sub">{formatClock(session)} session</div>
            </div>
          </div>
          {!r.invalid && (
            <div className="group vsTyping">
              <div className="top">vs typing</div>
              <div
                className={`bottom ${typing.personal ? "" : "average"}`}
                aria-label={typingTooltip}
                data-balloon-pos="up"
                data-balloon-break=""
              >
                <div>{typing.label}</div>
                {typing.personal ? (
                  <button type="button" className="sub editTyping" onClick={() => setEditingTyping(true)}>
                    your {typing.typingWpm} wpm
                  </button>
                ) : (
                  <div className="sub">avg typist</div>
                )}
              </div>
            </div>
          )}
        </div>

        {r.quote && (
          <div className="group source">
            <div className="top">source</div>
            <div className="bottom">{r.quote.source}</div>
          </div>
        )}

        <WordsHistory result={r} open={historyOpen} />

        {showTypingPrompt && (
          <TypingSpeedPrompt
            initial={typingWpm}
            autoFocus={editingTyping}
            onSave={saveTypingSpeed}
            onCancel={() => setEditingTyping(false)}
          />
        )}

        {capturing ? (
          <div className="ssWatermark">
            <div className="ssLogo">
              <LogoIcon className="ssLogoIcon" />
              <span>monkeyflow</span>
            </div>
            <div className="ssMeta">
              {formatDate(r.timestamp)} <span className="ssSep">|</span> {publicHost()}
            </div>
          </div>
        ) : (
          <div className="loginTip">
            <a
              href={appPath("login")}
              onClick={(e) => {
                e.preventDefault();
                useUi.getState().setPage("login");
              }}
            >
              Sign in
            </a>{" "}
            to save your result
          </div>
        )}

        <div className="resultButtons">
          <button
            type="button"
            id="nextTestButton"
            className="textButton resultButton"
            aria-label="Next test"
            data-balloon-pos="down"
            onClick={() => useTest.getState().newTest()}
          >
            <i className="fas fa-chevron-right fa-fw" />
          </button>
          <button
            type="button"
            id="restartTestButtonWithSameWordset"
            className="textButton resultButton"
            aria-label="Repeat test"
            data-balloon-pos="down"
            onClick={() => useTest.getState().newTest({ repeat: true })}
          >
            <i className="fas fa-sync-alt fa-fw" />
          </button>
          <button
            type="button"
            id="showWordHistoryButton"
            className="textButton resultButton"
            aria-label="Toggle words history"
            data-balloon-pos="down"
            onClick={() => useUi.getState().setWordsHistoryOpen(!historyOpen)}
          >
            <i className="fas fa-align-left fa-fw" />
          </button>
          <button
            type="button"
            id="copyChallengeLinkButton"
            className="textButton resultButton"
            aria-label="Copy challenge link"
            data-balloon-pos="down"
            onClick={copyChallengeLink}
          >
            <i className="fas fa-link fa-fw" />
          </button>
          <a
            id="shareOnXButton"
            className="textButton resultButton"
            href={xIntentUrl(brag)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share on X"
            data-balloon-pos="down"
          >
            <i className="fab fa-twitter fa-fw" />
          </a>
          <button
            type="button"
            id="saveScreenshotButton"
            className="textButton resultButton"
            aria-label={"Copy screenshot to clipboard\n(shift click to download)"}
            data-balloon-pos="down"
            data-balloon-break=""
            onClick={saveScreenshot}
          >
            <i className="far fa-image fa-fw" />
          </button>
        </div>
      </div>

      {voiceCommands && listening && (
        <div className="voiceHint">
          say <kbd>next</kbd> for a new test or <kbd>again</kbd> to repeat
        </div>
      )}
    </div>
  );
}
