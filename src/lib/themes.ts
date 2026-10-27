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

export function applyTheme(name: string): void {
  const t = getTheme(name);
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

export function updateFavicon(t: Theme): void {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${t.bg}"/><text x="32" y="44" font-family="monospace" font-size="34" text-anchor="middle" fill="${t.main}">mf</text></svg>`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
