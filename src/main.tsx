import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/test.css";
import App from "./App";
import { applyTheme } from "./lib/themes";
import { getConfig } from "./store/config";
import { resumeListeningIfAllowed } from "./store/voice";

applyTheme(getConfig().theme);
void resumeListeningIfAllowed();

const prefetch = () => void import("./components/result/ResultChart");
if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, { timeout: 3000 });
else setTimeout(prefetch, 1500);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
