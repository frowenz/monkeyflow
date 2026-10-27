import type { ReactNode } from "react";
import { useConfig, type Mode } from "../store/config";
import { useTest } from "../store/test";
import { useUi } from "../store/ui";
import type { QuoteLength } from "../lib/words";

function Btn({
  active,
  icon,
  children,
  onClick,
  label,
}: {
  active?: boolean;
  icon?: string;
  children?: ReactNode;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`textButton ${active ? "active" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      data-balloon-pos={label ? "up" : undefined}
    >
      {icon && <i className={`${icon} fa-fw`} />}
      {children}
    </button>
  );
}

function restartWith(patch: Parameters<ReturnType<typeof useConfig.getState>["patch"]>[0]) {
  useConfig.getState().patch(patch);
  useTest.getState().newTest();
}

const MODES: { mode: Mode; icon: string }[] = [
  { mode: "time", icon: "fas fa-clock" },
  { mode: "words", icon: "fas fa-font" },
  { mode: "quote", icon: "fas fa-quote-left" },
  { mode: "zen", icon: "fas fa-mountain" },
  { mode: "custom", icon: "fas fa-wrench" },
];

const TIMES = [15, 30, 60, 120];
const WORDS = [10, 25, 50, 100];
const QUOTES: QuoteLength[] = ["all", "short", "medium", "long", "thicc"];

export function TestConfig() {
  const c = useConfig();
  const focus = useUi((s) => s.focus);

  const showPunctuation = c.mode === "time" || c.mode === "words";

  return (
    <div id="testConfig" className={focus ? "hidden" : ""}>
      <button
        type="button"
        className="textButton mobileTestConfigButton"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => useUi.getState().openCommandLine()}
      >
        <i className="fas fa-cog" />
        test settings
      </button>
      <div className="cardWrap left">
        {showPunctuation && (
          <div className="card">
            <Btn active={c.punctuation} icon="fas fa-at" onClick={() => restartWith({ punctuation: !c.punctuation })}>
              punctuation
            </Btn>
            <Btn active={c.numbers} icon="fas fa-hashtag" onClick={() => restartWith({ numbers: !c.numbers })}>
              numbers
            </Btn>
          </div>
        )}
      </div>

      <div className="cardWrap center">
        <div className="card">
          {MODES.map((m) => (
            <Btn key={m.mode} active={c.mode === m.mode} icon={m.icon} onClick={() => restartWith({ mode: m.mode })}>
              {m.mode}
            </Btn>
          ))}
        </div>
      </div>

      <div className="cardWrap right">
        {c.mode === "time" && (
          <div className="card">
            {TIMES.map((t) => (
              <Btn key={t} active={c.time === t} onClick={() => restartWith({ time: t })}>
                {t}
              </Btn>
            ))}
            <Btn
              icon="fas fa-tools"
              active={!TIMES.includes(c.time)}
              onClick={() => useUi.getState().openCommandLine("time")}
            />
          </div>
        )}
        {c.mode === "words" && (
          <div className="card">
            {WORDS.map((w) => (
              <Btn key={w} active={c.words === w} onClick={() => restartWith({ words: w })}>
                {w}
              </Btn>
            ))}
            <Btn
              icon="fas fa-tools"
              active={!WORDS.includes(c.words)}
              onClick={() => useUi.getState().openCommandLine("words")}
            />
          </div>
        )}
        {c.mode === "quote" && (
          <div className="card">
            {QUOTES.map((q) => (
              <Btn key={q} active={c.quoteLength === q} onClick={() => restartWith({ quoteLength: q })}>
                {q}
              </Btn>
            ))}
            <Btn icon="fas fa-search" onClick={() => useUi.getState().openCommandLine("quotes")} />
          </div>
        )}
        {c.mode === "custom" && (
          <div className="card">
            <Btn icon="fas fa-pen" onClick={() => useUi.getState().setCustomTextOpen(true)}>
              change
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
