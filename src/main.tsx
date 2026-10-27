import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/lexend-deca/400.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/test.css";
import App from "./App";
import { applyTheme } from "./lib/themes";
import { getConfig } from "./store/config";
import "./store/voice";

applyTheme(getConfig().theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
