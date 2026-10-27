import { useTest } from "../store/test";
import { useUi, type Page } from "../store/ui";
import { LogoIcon } from "./Logo";

const NAV: { page: Page; icon: string; label: string }[] = [
  { page: "test", icon: "fas fa-keyboard", label: "test" },
  { page: "leaderboards", icon: "fas fa-crown", label: "leaderboards" },
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
  const notifications = useUi((s) => s.notifications.length);

  return (
    <header id="header">
      <a
        href="/"
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
            href={item.page === "test" ? "/" : `/${item.page}`}
            className={`textButton navButton ${page === item.page ? "current" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              go(item.page);
            }}
          >
            <i className={`${item.icon} fa-fw`} />
          </a>
        ))}
        <div className="grow" />
        <button
          type="button"
          className="textButton navButton"
          onClick={() =>
            useUi
              .getState()
              .notify(
                "Monkey Flow listens for your voice. Click the mic (or press enter) and start reading.",
                "notice",
              )
          }
        >
          <i className="fas fa-bell fa-fw" />
          {notifications > 0 && <span className="navDot" />}
        </button>
        <a
          href="/login"
          className={`textButton navButton ${page === "login" ? "current" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            go("login");
          }}
        >
          <i className="far fa-user fa-fw" />
        </a>
      </nav>
    </header>
  );
}
