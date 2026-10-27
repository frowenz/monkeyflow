import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WordResult } from "../../lib/align";
import { normalizeWord, similarity, wordsMatch } from "../../lib/normalize";
import { useConfig } from "../../store/config";
import { subscribeLevel, useVoice } from "../../store/voice";
import { useTest } from "../../store/test";

const RENDER_AHEAD = 120;

interface WordProps {
  text: string;
  result: WordResult | undefined;
  active: boolean;
  lenient: boolean;
}

const sameWord = (a: WordProps, b: WordProps) =>
  a.text === b.text &&
  a.active === b.active &&
  a.lenient === b.lenient &&
  a.result?.status === b.result?.status &&
  a.result?.input === b.result?.input;

const Word = memo(function Word({ text, result, active, lenient }: WordProps) {
  const status = result?.status;
  let letters: { ch: string; cls: string }[];

  if (!result) {
    letters = [...text].map((ch) => ({ ch, cls: "" }));
  } else if (status === "correct") {
    letters = [...text].map((ch) => ({ ch, cls: "correct" }));
  } else if (status === "incorrect" && similarity(normalizeWord(text), normalizeWord(result.input)) < 0.5) {
    letters = [...text].map((ch) => ({ ch, cls: "incorrect" }));
  } else if (status === "missed") {
    letters = [...text].map((ch) => ({ ch, cls: "" }));
  } else if (status === "partial" && lenient && wordsMatch(text, result.input, "lenient")) {
    letters = [...text].map((ch) => ({ ch, cls: "correct" }));
  } else {
    // keyboard typos and near-miss recognitions: per-letter, like monkeytype
    const input = lenient && status === "incorrect" ? result.input.replace(/[^\p{L}\p{N}']/gu, "") : result.input;
    const cmp = (a: string, b: string) => (lenient ? a.toLowerCase() === b.toLowerCase() : a === b);
    letters = [...text].map((ch, i) => ({
      ch,
      cls: i < input.length ? (cmp(input[i], ch) ? "correct" : "incorrect") : "",
    }));
    for (let i = text.length; i < input.length; i++) letters.push({ ch: input[i], cls: "incorrect extra" });
  }

  const error = status === "incorrect" || status === "missed";
  const cls = `word${active ? " active" : ""}${error ? " error" : ""}${result && !active ? " typed" : ""}`;
  return (
    <div className={cls}>
      {letters.map((l, i) => (
        <span key={i} className={`letter ${l.cls}`}>
          {l.ch}
        </span>
      ))}
    </div>
  );
}, sameWord);

export function Words({ blurred }: { blurred: boolean }) {
  const targets = useTest((s) => s.targets);
  const alignment = useTest((s) => s.alignment);
  const status = useTest((s) => s.status);
  const testId = useTest((s) => s.testId);
  const strictness = useConfig((s) => s.strictness);
  const smoothCaret = useConfig((s) => s.smoothCaret);
  const smoothLineScroll = useConfig((s) => s.smoothLineScroll);
  const flip = useConfig((s) => s.flipTestColors);
  const colorful = useConfig((s) => s.colorfulMode);

  const wordsRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const listening = useVoice((s) => s.listening);

  useEffect(
    () =>
      subscribeLevel((level) => {
        caretRef.current?.style.setProperty("--level", level.toFixed(3));
      }),
    [],
  );
  const [caret, setCaret] = useState({ left: 0, top: 0, height: 0 });
  const [scrollLines, setScrollLines] = useState(0);
  const [lineStep, setLineStep] = useState(51);
  const [noTransition, setNoTransition] = useState(true);

  const caretWord = alignment.caretWord;
  const caretLetter = alignment.caretLetter;
  const visibleCount = Math.min(targets.length, caretWord + RENDER_AHEAD);

  useLayoutEffect(() => {
    setScrollLines(0);
    setNoTransition(true);
    const id = requestAnimationFrame(() => setNoTransition(false));
    return () => cancelAnimationFrame(id);
  }, [testId]);

  useLayoutEffect(() => {
    const container = wordsRef.current;
    if (!container) return;
    const wordEls = container.children as HTMLCollectionOf<HTMLElement>;
    if (wordEls.length === 0) {
      setCaret({ left: 0, top: 0, height: 0 });
      return;
    }
    const first = wordEls[0];
    const style = getComputedStyle(first);
    const step = first.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    if (Math.abs(step - lineStep) > 0.5) setLineStep(step);

    const idx = Math.min(caretWord, wordEls.length - 1);
    const wordEl = wordEls[idx];
    const atEnd = caretWord >= wordEls.length;
    const letters = wordEl.children as HTMLCollectionOf<HTMLElement>;
    let left: number;
    let top: number;
    let height: number;
    if (letters.length === 0) {
      left = wordEl.offsetLeft;
      top = wordEl.offsetTop;
      height = wordEl.offsetHeight;
    } else if (!atEnd && caretLetter < letters.length) {
      const l = letters[caretLetter];
      left = wordEl.offsetLeft + l.offsetLeft;
      top = wordEl.offsetTop + l.offsetTop;
      height = l.offsetHeight;
    } else {
      const l = letters[letters.length - 1];
      left = wordEl.offsetLeft + l.offsetLeft + l.offsetWidth;
      top = wordEl.offsetTop + l.offsetTop;
      height = l.offsetHeight;
    }

    const lineIndex = Math.round((wordEl.offsetTop - first.offsetTop) / step);
    const nextScroll = Math.max(0, lineIndex - 1);
    if (nextScroll !== scrollLines) setScrollLines(nextScroll);
    const fontSize = parseFloat(getComputedStyle(container).fontSize);
    const caretHeight = fontSize * 1.2;
    setCaret({
      left: left - fontSize * 0.05,
      top: top - nextScroll * step + (height - caretHeight) / 2,
      height: caretHeight,
    });
  }, [caretWord, caretLetter, alignment, visibleCount, scrollLines, lineStep, testId]);

  const lenient = strictness === "lenient";
  const transition = noTransition ? "none" : undefined;

  return (
    <div id="wordsWrapper" style={{ height: lineStep * 3 }} className={blurred ? "blurred" : ""}>
      <div
        id="caret"
        ref={caretRef}
        className={`${status === "active" ? "typing" : ""} ${smoothCaret ? "smooth" : ""} ${listening ? "listening" : ""}`}
        style={{
          transform: `translate(${caret.left}px, ${caret.top}px)`,
          height: caret.height || undefined,
          transition,
          opacity: status === "finished" ? 0 : undefined,
        }}
      />
      <div
        id="words"
        ref={wordsRef}
        className={`${flip ? "flipped" : ""} ${colorful ? "colorfulMode" : ""} ${smoothLineScroll ? "smoothScroll" : ""}`}
        style={{ transform: `translateY(${-scrollLines * lineStep}px)`, transition }}
      >
        {targets.slice(0, visibleCount).map((w, i) => (
          <Word
            key={`${testId}-${i}`}
            text={w}
            result={alignment.words[i]}
            active={i === caretWord && status !== "finished"}
            lenient={lenient}
          />
        ))}
      </div>
    </div>
  );
}
