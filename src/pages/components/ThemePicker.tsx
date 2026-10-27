import { useMemo, useState, type CSSProperties } from "react";
import { THEMES, type Theme } from "../../lib/themes";
import { useConfig } from "../../store/config";
import { luminance } from "./format";

const FAV_KEY = "monkeyflow-favorite-themes";

function loadFavorites(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const SORTED: Theme[] = [...THEMES].sort((a, b) => luminance(b.bg) - luminance(a.bg) || a.name.localeCompare(b.name));

function ThemeButton({
  theme,
  active,
  favorite,
  onFavorite,
}: {
  theme: Theme;
  active: boolean;
  favorite: boolean;
  onFavorite: () => void;
}) {
  const style = {
    "--theme-bg": theme.bg,
    "--theme-main": theme.main,
    "--theme-sub": theme.sub,
    "--theme-text": theme.text,
  } as CSSProperties;
  return (
    <button
      type="button"
      className={`themeButton ${active ? "active" : ""}`}
      style={style}
      onClick={() => useConfig.getState().set("theme", theme.name)}
    >
      <div
        className={`themeFav ${favorite ? "on" : ""}`}
        role="button"
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onFavorite();
        }}
      >
        <i className={`${favorite ? "fas" : "far"} fa-star fa-fw`} />
      </div>
      <div className="themeName">{theme.name}</div>
      <div className="themeBubbles" />
    </button>
  );
}

export function ThemePicker() {
  const current = useConfig((s) => s.theme);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const toggleFavorite = (name: string) => {
    const next = favorites.includes(name) ? favorites.filter((f) => f !== name) : [...favorites, name];
    setFavorites(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const [favThemes, rest] = useMemo(
    () => [SORTED.filter((t) => favorites.includes(t.name)), SORTED.filter((t) => !favorites.includes(t.name))],
    [favorites],
  );

  const render = (t: Theme) => (
    <ThemeButton
      key={t.name}
      theme={t}
      active={t.name === current}
      favorite={favorites.includes(t.name)}
      onFavorite={() => toggleFavorite(t.name)}
    />
  );

  return (
    <div className="themePicker">
      {favThemes.length > 0 && <div className="themeGrid">{favThemes.map(render)}</div>}
      <div className="themeGrid">{rest.map(render)}</div>
    </div>
  );
}
