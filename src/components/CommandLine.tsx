import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  buildRows,
  GROUPS,
  rootGroup,
  stripEllipsis,
  usePreviewTheme,
  type Command,
  type CommandGroup,
  type CommandRow,
} from "../lib/commands";
import { applyTheme } from "../lib/themes";
import { useConfig } from "../store/config";
import { useUi } from "../store/ui";
import "../styles/commandline.css";

const ANIM_MS = 125;
const THEME_PREVIEW_DELAY = 150;

export function CommandLine() {
  const open = useUi((s) => s.commandLineOpen);
  const initial = useUi((s) => s.commandLineInitial);
  const [session, setSession] = useState<{ id: number; initial: string | null } | null>(null);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSession({ id: (session?.id ?? 0) + 1, initial });
      setClosing(false);
    } else if (session) {
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

  if (!session) return null;
  return <CommandLinePanel key={session.id} initial={session.initial} closing={closing} />;
}

interface SavedLevel {
  query: string;
  active: number;
}

function defaultActive(group: CommandGroup): number {
  if (group.id === "root") return 0;
  const i = group.list.findIndex((c) => c.active?.());
  return Math.max(0, i);
}

function previewTheme(name: string) {
  applyTheme(name);
  usePreviewTheme.setState({ name });
}

function clearThemePreview() {
  applyTheme(useConfig.getState().theme);
  usePreviewTheme.setState({ name: null });
}

function closeCommandLine() {
  useUi.getState().closeCommandLine();
  requestAnimationFrame(() => {
    const ui = useUi.getState();
    if (ui.customTextOpen || ui.commandLineOpen) return;
    document.getElementById("wordsInput")?.focus();
  });
}

function CommandLinePanel({ initial, closing }: { initial: string | null; closing: boolean }) {
  // Re-render on config changes so check marks always reflect the live config.
  useConfig((s) => s);

  const [stack, setStack] = useState<CommandGroup[]>(() => {
    const direct = initial ? GROUPS[initial] : undefined;
    return [direct ? direct() : rootGroup()];
  });
  const [saved, setSaved] = useState<SavedLevel[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(() => defaultActive(stack[0]));
  const [inputCmd, setInputCmd] = useState<Command | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [shake, setShake] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previewing = useRef(false);
  const scrollMode = useRef<"none" | "smooth" | "instant" | "center" | "top">("center");

  const group = stack[stack.length - 1];
  const isRoot = group.id === "root";
  const rows = useMemo(() => buildRows(group, query, isRoot), [group, query, isRoot]);
  const activeIdx = rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeRow: CommandRow | undefined = rows[activeIdx];
  const activeTheme = inputCmd ? undefined : activeRow?.command.theme?.name;
  const previewMode = !inputCmd && (group.id === "themes" || activeTheme !== undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputCmd, stack]);

  useEffect(
    () => () => {
      if (previewing.current) clearThemePreview();
    },
    [],
  );

  useEffect(() => {
    if (closing) return;
    if (activeTheme) {
      const t = window.setTimeout(() => {
        previewTheme(activeTheme);
        previewing.current = true;
      }, THEME_PREVIEW_DELAY);
      return () => window.clearTimeout(t);
    }
    if (previewing.current) {
      clearThemePreview();
      previewing.current = false;
    }
  }, [activeTheme, closing]);

  useLayoutEffect(() => {
    const mode = scrollMode.current;
    scrollMode.current = "none";
    const list = listRef.current;
    if (!list || mode === "none") return;
    if (mode === "top") {
      list.scrollTop = 0;
      return;
    }
    const el = list.querySelector<HTMLElement>(`[data-index="${activeIdx}"]`);
    if (!el) return;
    if (mode === "center") {
      list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
      return;
    }
    const behavior: ScrollBehavior = mode === "smooth" ? "smooth" : "instant";
    const isLast = activeIdx === rows.length - 1;
    const top = el.offsetTop;
    const bottom = isLast ? list.scrollHeight : top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top: activeIdx === 0 ? 0 : top, behavior });
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight, behavior });
  }, [activeIdx, rows]);

  const close = () => {
    if (closing) return;
    if (previewing.current) {
      clearThemePreview();
      previewing.current = false;
    }
    closeCommandLine();
  };

  const back = () => {
    if (inputCmd) {
      setInputCmd(null);
      return;
    }
    if (stack.length > 1) {
      const level = saved[saved.length - 1];
      setStack(stack.slice(0, -1));
      setSaved(saved.slice(0, -1));
      setQuery(level?.query ?? "");
      setActive(level?.active ?? 0);
      scrollMode.current = "center";
      return;
    }
    close();
  };

  const run = (cmd: Command) => {
    if (closing) return;
    if (cmd.subgroup) {
      const next = cmd.subgroup();
      setSaved([...saved, { query, active: activeIdx }]);
      setStack([...stack, next]);
      setQuery("");
      setActive(defaultActive(next));
      scrollMode.current = "center";
      return;
    }
    if (cmd.input) {
      setInputCmd(cmd);
      setInputValue(cmd.input.defaultValue?.() ?? "");
      return;
    }
    cmd.exec?.();
    close();
  };

  const submitInput = () => {
    if (!inputCmd) return;
    const valid = inputCmd.input?.validate ? inputCmd.input.validate(inputValue) : true;
    if (!valid) {
      setShake(true);
      return;
    }
    inputCmd.exec?.(inputValue);
    close();
  };

  const move = (delta: number, wrap = true) => {
    if (rows.length === 0) return;
    let next = activeIdx + delta;
    let wrapped = false;
    if (next < 0) {
      next = wrap && activeIdx === 0 ? rows.length - 1 : 0;
      wrapped = next === rows.length - 1;
    } else if (next >= rows.length) {
      next = wrap && activeIdx === rows.length - 1 ? 0 : rows.length - 1;
      wrapped = next === 0;
    }
    scrollMode.current = wrapped ? "instant" : "smooth";
    setActive(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (key === "Escape") {
      e.preventDefault();
      back();
      return;
    }
    if (ctrl && e.shiftKey && key.toLowerCase() === "p") {
      e.preventDefault();
      close();
      return;
    }
    if (inputCmd) {
      if (key === "Enter" || key === "Tab") e.preventDefault();
      if (key === "Enter") submitInput();
      return;
    }
    if (key === "ArrowDown" || (key === "Tab" && !e.shiftKey) || (ctrl && key.toLowerCase() === "j")) {
      e.preventDefault();
      move(1);
    } else if (key === "ArrowUp" || (key === "Tab" && e.shiftKey) || (ctrl && key.toLowerCase() === "k")) {
      e.preventDefault();
      move(-1);
    } else if (key === "PageDown") {
      e.preventDefault();
      move(10, false);
    } else if (key === "PageUp") {
      e.preventDefault();
      move(-10, false);
    } else if (key === "Enter") {
      e.preventDefault();
      if (activeRow) run(activeRow.command);
    }
  };

  const placeholder = inputCmd ? inputCmd.input?.placeholder : isRoot ? "Search..." : group.title;

  return (
    <div
      id="commandLineWrapper"
      className={`${closing ? "closing" : ""} ${previewMode ? "previewTheme" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        id="commandLine"
        className={shake ? "shake" : ""}
        role="dialog"
        aria-modal="true"
        aria-label="Command line"
        onAnimationEnd={(e) => {
          if (e.animationName === "mfCommandLineShake") setShake(false);
        }}
        onMouseDown={(e) => {
          if (e.target !== inputRef.current) e.preventDefault();
        }}
      >
        <div className="searchRow">
          <i className={`fas fa-fw ${inputCmd ? "fa-chevron-right" : "fa-search"} searchIcon`} />
          <input
            ref={inputRef}
            type="text"
            className="searchInput"
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={inputCmd ? inputValue : query}
            onChange={(e) => {
              if (inputCmd) {
                setInputValue(e.target.value);
                return;
              }
              setQuery(e.target.value);
              setActive(0);
              scrollMode.current = "top";
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {!inputCmd && (
          <div ref={listRef} className={`suggestions ${rows.length ? "hasRows" : ""}`} role="listbox">
            {rows.map((row, i) => (
              <Row
                key={row.key}
                row={row}
                index={i}
                isRoot={isRoot}
                active={i === activeIdx}
                onHover={() => {
                  if (i !== activeIdx) setActive(i);
                }}
                onRun={() => run(row.command)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ cmd }: { cmd: Command }) {
  return <i className={`fas fa-fw fa-check checkIcon ${cmd.active?.() ? "" : "invisible"}`} />;
}

function Row({
  row,
  index,
  isRoot,
  active,
  onHover,
  onRun,
}: {
  row: CommandRow;
  index: number;
  isRoot: boolean;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}) {
  const { command: cmd, parent } = row;
  const theme = cmd.theme;

  let icon;
  let text;
  if (parent) {
    icon = <i className={`fas fa-fw ${parent.icon ?? "fa-chevron-right"} rowIcon`} />;
    text = (
      <>
        {stripEllipsis(parent.title)}
        <i className="fas fa-fw fa-chevron-right chevron" />
        {cmd.active && <Check cmd={cmd} />}
        {cmd.display}
      </>
    );
  } else if (isRoot) {
    icon = <i className={`fas fa-fw ${cmd.icon ?? "fa-chevron-right"} rowIcon`} />;
    text = cmd.display;
  } else {
    icon = cmd.icon ? <i className={`fas fa-fw ${cmd.icon} rowIcon`} /> : <Check cmd={cmd} />;
    text = cmd.display;
  }

  const bubbles = theme
    ? ({
        "--bubble-bg": theme.bg,
        "--bubble-main": theme.main,
        "--bubble-sub": theme.sub,
        "--bubble-text": theme.text,
      } as CSSProperties)
    : undefined;

  return (
    <div
      data-index={index}
      role="option"
      aria-selected={active}
      className={`row ${active ? "active" : ""} ${theme ? "themeRow" : ""} ${cmd.extra ? "extraRow" : ""}`}
      onMouseMove={onHover}
      onClick={onRun}
    >
      <div>{icon}</div>
      <div className="rowText">{text}</div>
      {cmd.extra && <div className="rowExtra">{cmd.extra}</div>}
      {theme && <div className="themeBubbles" style={bubbles} />}
    </div>
  );
}
