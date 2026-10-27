import { usePreviewTheme } from "../lib/commands";
import { isTouchDevice } from "../lib/device";
import { useConfig } from "../store/config";
import { useTest } from "../store/test";
import { useUi } from "../store/ui";

const LINKS: { icon: string; label: string; href?: string }[] = [
  { icon: "fas fa-envelope", label: "contact" },
  { icon: "fas fa-donate", label: "support" },
  { icon: "fas fa-code", label: "github", href: "https://github.com/monkeytypegame/monkeytype" },
  { icon: "fab fa-discord", label: "discord" },
  { icon: "fab fa-twitter", label: "twitter", href: "https://x.com/WisprFlow" },
  { icon: "fas fa-file-contract", label: "terms" },
  { icon: "fas fa-shield-alt", label: "security" },
  { icon: "fas fa-lock", label: "privacy" },
];

export const VERSION = "v1.0.0";

export function Footer() {
  const configTheme = useConfig((s) => s.theme);
  const previewTheme = usePreviewTheme((s) => s.name);
  const theme = previewTheme ?? configTheme;
  const page = useUi((s) => s.page);
  const mode = useConfig((s) => s.mode);
  const finished = useTest((s) => s.status === "finished");
  const showMicHint = page === "test" && !finished && !isTouchDevice();

  return (
    <footer id="footer">
      <div className={`keyTips ${showMicHint ? "withVoiceHint" : ""}`}>
        <div>
          <kbd>tab &gt; enter</kbd>
          <span>- restart test</span>
        </div>
        {showMicHint && (
          <div>
            <kbd>enter</kbd>
            <span>- start / stop listening</span>
          </div>
        )}
        {page === "test" && mode === "zen" && !finished && (
          <div>
            <kbd>shift + enter</kbd>
            <span>- finish zen</span>
          </div>
        )}
        <div>
          <kbd>escape</kbd>&nbsp;or&nbsp;<kbd>ctrl + shift + p</kbd>
          <span>- command line</span>
        </div>
      </div>
      <div className="footerBottom">
        <div className="footerLinks">
          {LINKS.map((l) =>
            l.href ? (
              <a key={l.label} className="textButton" href={l.href} target="_blank" rel="noreferrer noopener">
                <i className={`${l.icon} fa-fw`} />
                {l.label}
              </a>
            ) : (
              <button
                key={l.label}
                type="button"
                className="textButton"
                onClick={() => useUi.getState().setPage("about")}
              >
                <i className={`${l.icon} fa-fw`} />
                {l.label}
              </button>
            ),
          )}
        </div>
        <div className="footerRight">
          <button
            type="button"
            className="textButton"
            aria-label="Click to change theme"
            data-balloon-pos="left"
            onClick={() => useUi.getState().openCommandLine("themes")}
          >
            <i className="fas fa-palette fa-fw" />
            <div className="text">{theme}</div>
          </button>
          <button
            type="button"
            className="textButton"
            onClick={() => useUi.getState().setPage("about")}
          >
            <i className="fas fa-code-branch fa-fw" />
            <div className="text">{VERSION}</div>
          </button>
        </div>
      </div>
    </footer>
  );
}
