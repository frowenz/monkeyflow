/** Where the app is served from: "/" locally, "/monkeyflow/" on GitHub Pages. Always ends with "/". */
export const BASE = import.meta.env.BASE_URL;

/** App-relative path ("settings" -> "/monkeyflow/settings"). */
export function appPath(path = ""): string {
  return BASE + path.replace(/^\/+/, "");
}
