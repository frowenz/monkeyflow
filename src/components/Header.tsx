import { useTest } from "../store/test";
import { useUi, type Page } from "../store/ui";
import { LogoIcon } from "./Logo";
import { appPath } from "../lib/base";

const NAV: { page: Page; icon: string; label: string }[] = [
  { page: "test", icon: "fas fa-keyboard", label: "test" },
  { page: "leaderboards", icon: "fas fa-crown", label: "your results" },
  { page: "about", icon: "fas fa-info", label: "about" },
  { page: "settings", icon: "fas fa-cog", label: "settings" },
];

function go(page: Page) {
  const ui = useUi.getState();
  if (page === "test") {
    if (ui.page === "test") useTest.getState().newTest();
  }
  ui.setPage(page);
}

export function Header() {
  const page = useUi((s) => s.page);

  return (
    <header id="header">
      <a
        href={appPath()}
        className="logo"
        aria-label="Monkey Flow Home"
        onClick={(e) => {
          e.preventDefault();
          go("test");
        }}
      >
        <LogoIcon className="logoIcon" />
        <div className="logoTextWrap">
          <div className="logoSubtext">monkey say</div>
          <h1 className="logoText">monkeyflow</h1>
        </div>
      </a>
      <nav>
        {NAV.map((item) => (
          <a
            key={item.page}
            href={appPath(item.page === "test" ? "" : item.page)}
            className={`textButton navButton ${page === item.page ? "current" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              go(item.page);
            }}
          >
            <i className={`${item.icon} fa-fw`} />
          </a>
        ))}
      </nav>
    </header>
  );
}
