import { useEffect } from "react";
import { getConfig } from "../store/config";
import { useTest } from "../store/test";
import { useUi } from "../store/ui";
import { toggleListening } from "../store/voice";

export function useGlobalKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (ui.commandLineOpen || ui.customTextOpen) return;

      if (e.key === "Escape" || (e.key.toLowerCase() === "p" && e.ctrlKey && e.shiftKey)) {
        e.preventDefault();
        ui.openCommandLine();
        return;
      }

      if (ui.page !== "test") return;
      const test = useTest.getState();
      const active = document.activeElement as HTMLElement | null;
      const onButton = active?.tagName === "BUTTON" || active?.tagName === "A";

      if (e.key === "Tab") {
        e.preventDefault();
        const id = test.status === "finished" ? "nextTestButton" : "restartTestButton";
        document.getElementById(id)?.focus();
        return;
      }

      if (e.key === "Enter") {
        if (onButton) return;
        e.preventDefault();
        if (e.shiftKey && getConfig().mode === "zen" && test.status === "active") {
          test.finish();
          return;
        }
        if (test.status !== "finished") toggleListening();
        return;
      }

      if (
        test.status !== "finished" &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        active?.id !== "wordsInput"
      ) {
        document.getElementById("wordsInput")?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
