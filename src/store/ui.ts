import { create } from "zustand";
import { appPath } from "../lib/base";

export type Page = "test" | "settings" | "about" | "leaderboards";

export type NotificationType = "notice" | "success" | "error";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  text: string;
  closing?: boolean;
}

interface UiState {
  page: Page;
  focus: boolean;
  commandLineOpen: boolean;
  commandLineInitial: string | null;
  customTextOpen: boolean;
  wordsHistoryOpen: boolean;
  notifications: Notification[];
  setPage: (page: Page) => void;
  setFocus: (focus: boolean) => void;
  openCommandLine: (initial?: string | null) => void;
  closeCommandLine: () => void;
  setCustomTextOpen: (open: boolean) => void;
  setWordsHistoryOpen: (open: boolean) => void;
  notify: (text: string, type?: NotificationType, title?: string) => void;
  dismiss: (id: number) => void;
}

const PATHS: Record<Page, string> = {
  test: appPath(),
  settings: appPath("settings"),
  about: appPath("about"),
  leaderboards: appPath("leaderboards"),
};

function pageFromPath(path: string): Page {
  const entry = Object.entries(PATHS).find(([, p]) => p === path || p === `${path}/`);
  return (entry?.[0] as Page) ?? "test";
}

let nextId = 1;

export const useUi = create<UiState>((set, get) => ({
  page: typeof window !== "undefined" ? pageFromPath(window.location.pathname) : "test",
  focus: false,
  commandLineOpen: false,
  commandLineInitial: null,
  customTextOpen: false,
  wordsHistoryOpen: false,
  notifications: [],
  setPage: (page) => {
    if (get().page === page) return;
    if (window.location.pathname !== PATHS[page]) window.history.pushState({}, "", PATHS[page]);
    set({ page, focus: false });
  },
  setFocus: (focus) => {
    if (get().focus !== focus) set({ focus });
  },
  openCommandLine: (initial = null) => set({ commandLineOpen: true, commandLineInitial: initial, focus: false }),
  closeCommandLine: () => set({ commandLineOpen: false, commandLineInitial: null }),
  setCustomTextOpen: (open) => set({ customTextOpen: open }),
  setWordsHistoryOpen: (open) => set({ wordsHistoryOpen: open }),
  notify: (text, type = "notice", title) => {
    const id = nextId++;
    const n: Notification = {
      id,
      type,
      text,
      title: title ?? (type === "error" ? "Error" : type === "success" ? "Success" : "Notice"),
    };
    set({ notifications: [n, ...get().notifications].slice(0, 5) });
    window.setTimeout(() => get().dismiss(id), type === "error" ? 6000 : 3500);
  },
  dismiss: (id) => {
    if (!get().notifications.some((n) => n.id === id && !n.closing)) return;
    set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, closing: true } : n)) });
    window.setTimeout(() => set({ notifications: get().notifications.filter((n) => n.id !== id) }), 250);
  },
}));

window.addEventListener("popstate", () => {
  useUi.setState({ page: pageFromPath(window.location.pathname) });
});

export const notify = (text: string, type?: NotificationType, title?: string) =>
  useUi.getState().notify(text, type, title);
