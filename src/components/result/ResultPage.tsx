import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { QUOTE_GROUPS } from "../../lib/words";
import { captureElement, copyImageOrDownload, screenshotFilename } from "../../lib/screenshot";
import { useConfig } from "../../store/config";
import { useTest, type TestResult } from "../../store/test";
import { notify, useUi } from "../../store/ui";
import { useVoice } from "../../store/voice";
import { LogoIcon } from "../Logo";
import { ResultChart } from "./ResultChart";
import { WordsHistory } from "./WordsHistory";
import "../../styles/result.css";

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
  lines.push(r.engine === "flow" ? "wispr flow" : "built-in");
  return lines;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString("en-US", { month: "short" });
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function ResultPage() {
  const result = useTest((s) => s.result);
  const historyOpen = useUi((s) => s.wordsHistoryOpen);
  const voiceCommands = useConfig((s) => s.voiceCommands);
  const listening = useVoice((s) => s.listening);
  const [session] = useState(() => (result ? addToSession(result) : 0));
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
    copyImageOrDownload(blob, screenshotFilename(r.timestamp), forceDownload)
      .then((how) => notify(how === "copied" ? "Copied to clipboard" : "Screenshot downloaded", "success"))
      .catch(() => notify("Couldn't save the screenshot", "error"));
  };

  return (
    <div
      id="result"
      ref={rootRef}
      className={capturing ? "capturing" : ""}
      style={lockedHeight ? { minHeight: lockedHeight } : undefined}
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
          <ResultChart result={r} />
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
        </div>

        {r.quote && (
          <div className="group source">
            <div className="top">source</div>
            <div className="bottom">{r.quote.source}</div>
          </div>
        )}

        <WordsHistory result={r} open={historyOpen} />

        {capturing ? (
          <div className="ssWatermark">
            <div className="ssLogo">
              <LogoIcon className="ssLogoIcon" />
              <span>monkeyflow</span>
            </div>
            <div className="ssMeta">
              {formatDate(r.timestamp)} <span className="ssSep">|</span> voice typing test
            </div>
          </div>
        ) : (
          <div className="loginTip">
            <a
              href="/login"
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
            className="textButton resultButton spanTwo"
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
            id="saveScreenshotButton"
            className="textButton resultButton spanTwo"
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
