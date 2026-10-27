import themesData from "../data/themes.json";

export interface Theme {
  name: string;
  bg: string;
  main: string;
  caret: string;
  sub: string;
  subAlt: string;
  text: string;
  error: string;
  errorExtra: string;
  colorfulError: string;
  colorfulErrorExtra: string;
}

export const THEMES: Theme[] = themesData as Theme[];

export function getTheme(name: string): Theme {
  return THEMES.find((t) => t.name === name) ?? THEMES[0];
}

let currentThemeName = THEMES[0].name;

export function applyTheme(name: string): void {
  const t = getTheme(name);
  currentThemeName = t.name;
  const root = document.documentElement.style;
  root.setProperty("--bg-color", t.bg);
  root.setProperty("--main-color", t.main);
  root.setProperty("--caret-color", t.caret);
  root.setProperty("--sub-color", t.sub);
  root.setProperty("--sub-alt-color", t.subAlt);
  root.setProperty("--text-color", t.text);
  root.setProperty("--error-color", t.error);
  root.setProperty("--error-extra-color", t.errorExtra);
  root.setProperty("--colorful-error-color", t.colorfulError);
  root.setProperty("--colorful-error-extra-color", t.colorfulErrorExtra);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.bg);
  updateFavicon(t);
}

let faviconTemplate: Promise<string | null> | null = null;

/** Recolors public/favicon.svg (authored in serika dark) to match the active theme. */
export function updateFavicon(t: Theme): void {
  faviconTemplate ??= fetch("/favicon.svg")
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null);
  void faviconTemplate.then((template) => {
    if (!template || getTheme(currentThemeName).name !== t.name) return;
    const svg = template.replaceAll("#323437", t.bg).replaceAll("#e2b714", t.main);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.prepend(link);
    }
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
}
