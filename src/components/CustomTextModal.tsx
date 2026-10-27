import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useConfig } from "../store/config";
import { useTest } from "../store/test";
import { useUi } from "../store/ui";
import "../styles/modal.css";

const ANIM_MS = 125;
const SAVED_KEY = "monkeyflow-saved-texts";

interface SavedText {
  name: string;
  text: string;
}

function loadSaved(): SavedText[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeSaved(list: SavedText[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}

function nameFor(text: string): string {
  const name = text.trim().split(/\s+/).slice(0, 4).join(" ");
  return name.length > 28 ? `${name.slice(0, 27)}…` : name;
}

const removeZeroWidth = (t: string) => t.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

const removeFancyTypography = (t: string) =>
  t
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F]/g, " ");

const replaceControlChars = (t: string) => t.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

const newLinesToSpaces = (t: string, period: boolean) =>
  t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (period && !/[.?!:;,]$/.test(l) ? `${l}.` : l))
    .join(" ");

export function CustomTextModal() {
  const open = useUi((s) => s.customTextOpen);
  const [session, setSession] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSession((session ?? 0) + 1);
      setClosing(false);
    } else if (session !== null) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setSession(null);
      setClosing(false);
    }, ANIM_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  if (session === null) return null;
  return <CustomTextPanel key={session} closing={closing} />;
}

function close() {
  useUi.getState().setCustomTextOpen(false);
  requestAnimationFrame(() => {
    const ui = useUi.getState();
    if (!ui.customTextOpen && !ui.commandLineOpen) document.getElementById("wordsInput")?.focus();
  });
}

function Section({ icon, title, desc, children }: { icon: string; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="ctSection">
      <div className="ctSectionTitle">
        <i className={`fas fa-fw ${icon}`} />
        {title}
      </div>
      <div className="ctSectionDesc">{desc}</div>
      <div className="ctSectionButtons">{children}</div>
    </div>
  );
}

function CustomTextPanel({ closing }: { closing: boolean }) {
  const [text, setText] = useState(() => useConfig.getState().customText);
  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState<SavedText[]>(loadSaved);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);

  const transform = (fn: (t: string) => string) => {
    setText((t) => fn(t));
    textareaRef.current?.focus();
  };

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    if (closing) return;
    const value = text.trim();
    if (!value) {
      useUi.getState().notify("Custom text can't be empty", "error");
      return;
    }
    useConfig.getState().patch({ customText: value, mode: "custom" });
    close();
    useTest.getState().newTest();
  };

  const save = () => {
    const value = text.trim();
    if (!value) {
      useUi.getState().notify("Custom text can't be empty", "error");
      return;
    }
    if (saved.some((s) => s.text === value)) {
      useUi.getState().notify("This text is already saved", "notice");
      return;
    }
    const next = [{ name: nameFor(value), text: value }, ...saved].slice(0, 30);
    setSaved(next);
    storeSaved(next);
    useUi.getState().notify("Custom text saved", "success");
  };

  const remove = (index: number) => {
    const next = saved.filter((_, i) => i !== index);
    setSaved(next);
    storeSaved(next);
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((content) => {
        setText(content);
        textareaRef.current?.focus();
      })
      .catch(() => useUi.getState().notify("Failed to read file", "error"));
  };

  return (
    <div
      id="customTextModalWrapper"
      className={`mfModalWrapper ${closing ? "closing" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          apply();
        } else if (e.key === "Tab") {
          const focusable = [
            ...e.currentTarget.querySelectorAll<HTMLElement>("#customTextModal button, #customTextModal textarea"),
          ];
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div id="customTextModal" className="mfModal" tabIndex={-1} role="dialog" aria-modal="true" aria-label="Custom text">
        <form className="ctForm" onSubmit={apply}>
          <div className="ctSeparator" />
          <div className="ctMain">
            <div className="ctTopButtons">
              <button type="button" className="button" onClick={save}>
                <i className="fas fa-save" />
                save
              </button>
              <button
                type="button"
                className={`button ${showSaved ? "active" : ""}`}
                onClick={() => setShowSaved((s) => !s)}
              >
                <i className="fas fa-folder" />
                saved texts
              </button>
            </div>
            <textarea
              ref={textareaRef}
              id="customTextInput"
              className="input"
              dir="auto"
              spellCheck={false}
              placeholder="type or paste your custom text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="button">
              ok
            </button>
          </div>

          <div className="ctSide">
            {showSaved ? (
              <div className="ctSection">
                <div className="ctSectionTitle">
                  <i className="fas fa-fw fa-folder" />
                  saved texts
                </div>
                <div className="ctSectionDesc">Click a text to load it into the editor.</div>
                {saved.length === 0 ? (
                  <div className="ctEmpty">nothing saved yet</div>
                ) : (
                  <div className="ctSavedList">
                    {saved.map((s, i) => (
                      <div key={`${s.name}-${i}`} className="ctSavedItem">
                        <button
                          type="button"
                          className="button ctSavedName"
                          title={s.text}
                          onClick={() => {
                            setText(s.text);
                            textareaRef.current?.focus();
                          }}
                        >
                          {s.name}
                        </button>
                        <button
                          type="button"
                          className="button ctSavedDelete"
                          aria-label="delete"
                          onClick={() => remove(i)}
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="ctStack">
                  <button type="button" className="button" onClick={() => fileRef.current?.click()}>
                    <i className="fas fa-file-import" />
                    open file
                  </button>
                  <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onFile} />
                </div>
                <Section
                  icon="fa-text-slash"
                  title="remove zero-width characters"
                  desc="Fully remove zero-width characters."
                >
                  <button type="button" className="button" onClick={() => transform(removeZeroWidth)}>
                    apply
                  </button>
                </Section>
                <Section
                  icon="fa-pen-fancy"
                  title="remove fancy typography"
                  desc={"Standardises typography symbols (for example \u201C and \u201D become \")"}
                >
                  <button type="button" className="button" onClick={() => transform(removeFancyTypography)}>
                    apply
                  </button>
                </Section>
                <Section
                  icon="fa-wave-square"
                  title="replace control characters"
                  desc={"Replace control characters (\\n becomes a new line and \\t becomes a tab)"}
                >
                  <button type="button" className="button" onClick={() => transform(replaceControlChars)}>
                    apply
                  </button>
                </Section>
                <Section
                  icon="fa-level-down-alt fa-rotate-90"
                  title="replace new lines with spaces"
                  desc="Replace all new line characters with spaces. Can automatically add periods to the end of lines if you wish."
                >
                  <button type="button" className="button" onClick={() => transform((t) => newLinesToSpaces(t, false))}>
                    space
                  </button>
                  <button type="button" className="button" onClick={() => transform((t) => newLinesToSpaces(t, true))}>
                    period + space
                  </button>
                </Section>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
