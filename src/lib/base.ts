/** Where the app is served from: "/" locally, "/monkeyflow/" on GitHub Pages. Always ends with "/". */
export const BASE = import.meta.env.BASE_URL;

/** App-relative path ("settings" -> "/monkeyflow/settings"). */
export function appPath(path = ""): string {
  return BASE + path.replace(/^\/+/, "");
}

/**
 * Canonical public address used in shared links and screenshots (e.g. a stable
 * front door that forwards to wherever the app is currently hosted).
 */
export const PUBLIC_URL: string = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || "";

/** Origin + base path that shared links should point at. */
export function publicRoot(): string {
  return PUBLIC_URL ? PUBLIC_URL.replace(/\/?$/, "/") : `${window.location.origin}${BASE}`;
}

export function publicHost(): string {
  return PUBLIC_URL ? new URL(PUBLIC_URL).host + new URL(PUBLIC_URL).pathname.replace(/\/$/, "") : window.location.host;
}
