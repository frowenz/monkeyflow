import { useEffect } from "react";
import { CommandLine } from "./components/CommandLine";
import { CustomTextModal } from "./components/CustomTextModal";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Notifications } from "./components/Notifications";
import { TestPage } from "./components/test/TestPage";
import { useChallengeLink } from "./hooks/useChallengeLink";
import { useGlobalKeys } from "./hooks/useGlobalKeys";
import { applyTheme } from "./lib/themes";
import { AboutPage } from "./pages/AboutPage";
import { LeaderboardsPage } from "./pages/LeaderboardsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useConfig } from "./store/config";
import { useTest } from "./store/test";
import { useUi } from "./store/ui";

function useFocusMode() {
  useEffect(() => {
    let last = { x: -1, y: -1 };
    const onMove = (e: MouseEvent) => {
      if (last.x >= 0 && Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 3) {
        useUi.getState().setFocus(false);
      }
      last = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    let prevStatus = useTest.getState().status;
    let prevLen = useTest.getState().tokens.length;
    const unsub = useTest.subscribe((s) => {
      if (s.status !== prevStatus) {
        useUi.getState().setFocus(s.status === "active");
        prevStatus = s.status;
      } else if (s.status === "active" && s.tokens.length !== prevLen) {
        useUi.getState().setFocus(true);
      }
      prevLen = s.tokens.length;
    });
    return () => {
      window.removeEventListener("mousemove", onMove);
      unsub();
    };
  }, []);
}

export default function App() {
  const page = useUi((s) => s.page);
  const focus = useUi((s) => s.focus);
  const theme = useConfig((s) => s.theme);

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    document.body.classList.toggle("focus", focus);
  }, [focus]);
  useFocusMode();
  useGlobalKeys();
  useChallengeLink();

  return (
    <div id="app" className={`content-grid ${focus ? "focus" : ""}`}>
      <Header />
      {page === "test" && <TestPage />}
      {page === "settings" && <SettingsPage />}
      {page === "about" && <AboutPage />}
      {page === "leaderboards" && <LeaderboardsPage />}
      <Footer />
      <CommandLine />
      <CustomTextModal />
      <Notifications />
    </div>
  );
}
