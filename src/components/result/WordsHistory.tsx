import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { isFiller, normalizeWord } from "../../lib/normalize";
import type { HistoryWord, TestResult } from "../../store/test";
import { notify } from "../../store/ui";

function Letters({ word }: { word: HistoryWord }) {
  const { target, status, input } = word;
  if (status === "partial") {
    return (
      <>
        {[...target].map((ch, i) => {
          const typed = input[i];
          const cls = typed === undefined ? "" : typed.toLowerCase() === ch.toLowerCase() ? "correct" : "incorrect";
          return (
            <span key={i} className={`letter ${cls}`}>
              {ch}
            </span>
          );
        })}
      </>
    );
  }
  const cls = status === "correct" ? "correct" : status === "incorrect" ? "incorrect" : "";
  return (
    <>
      {[...target].map((ch, i) => (
        <span key={i} className={`letter ${cls}`}>
          {ch}
        </span>
      ))}
    </>
  );
}

function HistoryWordView({ word }: { word: HistoryWord }) {
  const error = word.status === "incorrect" || word.status === "missed";
  let popup: string | null = null;
  if (word.status === "missed") popup = "missed";
  else if (word.status !== "untouched" && word.input) popup = `heard: "${word.input}"`;
  return (
    <div className={`word ${word.status} ${error ? "error" : ""}`}>
      <Letters word={word} />
      {popup && <div className="wordInputHighlight">{popup}</div>}
    </div>
  );
}

function transcript(result: TestResult): string {
  const out: string[] = [];
  const extrasAt = (i: number) => result.extras.filter((e) => e.afterTarget === i).map((e) => e.text);
  result.words.forEach((w, i) => {
    out.push(...extrasAt(i));
    if (w.input && w.status !== "missed" && w.status !== "untouched") out.push(w.input);
  });
  out.push(...extrasAt(result.words.length));
  return out.join(" ");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied to clipboard", "success");
  } catch {
    notify("Couldn't copy to clipboard", "error");
  }
}

function HistoryBody({ result }: { result: TestResult }) {
  const nodes: ReactNode[] = [];
  const pushExtras = (i: number) => {
    result.extras.forEach((e, k) => {
      if (e.afterTarget !== i) return;
      const filler = isFiller(normalizeWord(e.text));
      nodes.push(
        <div key={`x${k}`} className={`word extra ${filler ? "filler" : ""}`}>
          {e.text}
          <div className="wordInputHighlight">{filler ? "filler" : "extra"}</div>
        </div>,
      );
    });
  };
  result.words.forEach((w, i) => {
    pushExtras(i);
    nodes.push(<HistoryWordView key={`w${i}`} word={w} />);
  });
  pushExtras(result.words.length);

  const missed = result.words.filter((w) => w.status === "incorrect" || w.status === "missed").map((w) => w.target);

  return (
    <div id="resultWordsHistory">
      <div className="historyTitle">
        <span>input history</span>
        <button
          type="button"
          tabIndex={-1}
          className="textButton historyButton first"
          aria-label="Copy words list"
          data-balloon-pos="up"
          onClick={() => copyText(result.words.map((w) => w.target).join(" "))}
        >
          <i className="fas fa-align-left fa-fw" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="textButton historyButton"
          aria-label="Copy missed words list"
          data-balloon-pos="up"
          onClick={() => (missed.length ? copyText(missed.join(" ")) : notify("No missed words", "notice"))}
        >
          <i className="fas fa-times fa-fw" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="textButton historyButton"
          aria-label="Copy what was heard"
          data-balloon-pos="up"
          onClick={() => copyText(transcript(result))}
        >
          <i className="fas fa-microphone-alt fa-fw" />
        </button>
      </div>
      <div className="words">{nodes}</div>
    </div>
  );
}

const SLIDE_MS = 250;

export function WordsHistory({ result, open }: { result: TestResult; open: boolean }) {
  const [rendered, setRendered] = useState(open);
  const animateOpen = useRef(!open);
  const ref = useRef<HTMLDivElement>(null);

  if (open && !rendered) setRendered(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !animateOpen.current) return;
    animateOpen.current = true;
    const full = el.scrollHeight;
    const frames = open
      ? [{ height: "0px", opacity: 0 }, { height: `${full}px`, opacity: 1 }]
      : [{ height: `${el.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }];
    el.style.overflow = "hidden";
    const anim = el.animate(frames, { duration: SLIDE_MS, easing: "ease-in-out", fill: open ? "none" : "forwards" });
    anim.onfinish = () => {
      el.style.overflow = "";
      if (!open) setRendered(false);
    };
    return () => {
      anim.onfinish = null;
      anim.cancel();
      el.style.overflow = "";
    };
  }, [open, rendered]);

  if (!rendered) return null;
  return (
    <div className="historyWrapper" ref={ref}>
      <HistoryBody result={result} />
    </div>
  );
}
