import { useMemo, useState } from "react";
import { useConfig } from "../store/config";
import { savedResults, useTest, type TestResult } from "../store/test";
import { useUi } from "../store/ui";
import { formatClock, formatDate } from "./components/format";
import "../styles/pages.css";

type Period = "allTime" | "weekly" | "daily";
type Board = "time15" | "time30" | "time60" | "words" | "quote";

const PERIODS: { id: Period; icon: string; label: string; title: string }[] = [
  { id: "allTime", icon: "fas fa-globe-americas", label: "all-time", title: "All-time" },
  { id: "weekly", icon: "fas fa-calendar-day", label: "weekly", title: "Weekly" },
  { id: "daily", icon: "fas fa-sun", label: "daily", title: "Daily" },
];

const BOARDS: { id: Board; icon: string; label: string; title: string; match: (r: TestResult) => boolean }[] = [
  {
    id: "time15",
    icon: "fas fa-clock",
    label: "time 15",
    title: "Time 15",
    match: (r) => r.mode === "time" && r.mode2 === "15",
  },
  {
    id: "time30",
    icon: "fas fa-clock",
    label: "time 30",
    title: "Time 30",
    match: (r) => r.mode === "time" && r.mode2 === "30",
  },
  {
    id: "time60",
    icon: "fas fa-clock",
    label: "time 60",
    title: "Time 60",
    match: (r) => r.mode === "time" && r.mode2 === "60",
  },
  { id: "words", icon: "fas fa-font", label: "words", title: "Words", match: (r) => r.mode === "words" },
  { id: "quote", icon: "fas fa-quote-left", label: "quote", title: "Quote", match: (r) => r.mode === "quote" },
];

const PAGE_SIZE = 50;

function defaultBoard(): Board {
  const c = useConfig.getState();
  if (c.mode === "time" && [15, 30, 60].includes(c.time)) return `time${c.time}` as Board;
  if (c.mode === "words" || c.mode === "quote") return c.mode;
  return "time30";
}

function since(period: Period): number {
  if (period === "allTime") return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "weekly") d.setDate(d.getDate() - 6);
  return d.getTime();
}

function testLabel(r: TestResult): string {
  if (r.mode === "quote") return r.mode2 && r.mode2 !== "all" ? `quote ${r.mode2}` : "quote";
  return `${r.mode} ${r.mode2}`;
}

function testDetail(r: TestResult): string {
  const parts = [r.engine === "flow" ? "wispr flow" : r.engine === "keyboard" ? "keyboard" : "voice"];
  if (r.language && r.language !== "english") parts.push(r.language);
  if (r.punctuation) parts.push("punctuation");
  if (r.numbers) parts.push("numbers");
  return parts.join(" · ");
}

const pct = (n: number) => `${n.toFixed(2)}%`;

function goToPage(pages: number, setPage: (page: number) => void) {
  if (pages === 1) return;
  const n = Number(window.prompt(`Go to page (1-${pages}):`));
  if (Number.isInteger(n) && n >= 1 && n <= pages) setPage(n - 1);
}

function startBoard(board: Board) {
  const config = useConfig.getState();
  if (board.startsWith("time")) config.patch({ mode: "time", time: Number(board.slice(4)) });
  else config.patch({ mode: board as "words" | "quote" });
  useTest.getState().newTest();
  useUi.getState().setPage("test");
}

export function LeaderboardsPage() {
  const [period, setPeriod] = useState<Period>("allTime");
  const [board, setBoard] = useState<Board>(defaultBoard);
  const [page, setPage] = useState(0);
  const all = useMemo(() => savedResults(), []);

  const boardSpec = BOARDS.find((b) => b.id === board)!;
  const periodSpec = PERIODS.find((p) => p.id === period)!;

  const rows = useMemo(() => {
    const from = since(period);
    return all
      .filter((r) => boardSpec.match(r) && r.timestamp >= from)
      .sort((a, b) => b.wpm - a.wpm || b.acc - a.acc || a.timestamp - b.timestamp);
  }, [all, boardSpec, period]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const pick = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <main className="page pageLeaderboards">
      <div className="lbSide">
        <div className="lbPanel">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`button ${period === p.id ? "active" : ""}`}
              onClick={() => pick(() => setPeriod(p.id))}
            >
              <i className={p.icon} />
              {p.label}
            </button>
          ))}
        </div>
        <div className="lbPanel">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`button ${board === b.id ? "active" : ""}`}
              onClick={() => pick(() => setBoard(b.id))}
            >
              <i className={b.icon} />
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lbMain">
        <div>
          <h2 className="lbTitle">
            {periodSpec.title} {boardSpec.title} - Your Results
          </h2>
        </div>
        <div className="lbDivider" />
        <div>
          <div className="lbTopRow">
            <div className="info">
              {rows.length} {rows.length === 1 ? "result" : "results"} saved on this device
            </div>
            <div className="lbPager">
              <button
                type="button"
                className="button"
                disabled={current === 0}
                aria-label="First page"
                onClick={() => setPage(0)}
              >
                <i className="fas fa-crown fa-fw" />
              </button>
              <button
                type="button"
                className="button"
                disabled={current === 0}
                aria-label="Previous page"
                onClick={() => setPage(current - 1)}
              >
                <i className="fas fa-chevron-left fa-fw" />
              </button>
              <button type="button" className="button" aria-label="Go to page" onClick={() => goToPage(pages, setPage)}>
                <i className="fas fa-hashtag fa-fw" /> {current + 1}
              </button>
              <button
                type="button"
                className="button"
                disabled={current >= pages - 1}
                aria-label="Next page"
                onClick={() => setPage(current + 1)}
              >
                <i className="fas fa-chevron-right fa-fw" />
              </button>
            </div>
          </div>

          <div className="lbTableWrap">
            <table className="lbTable">
              <thead>
                <tr>
                  <th className="rank" aria-label="Rank" data-balloon-pos="down">
                    <i className="fas fa-hashtag" />
                  </th>
                  <th className="name">name</th>
                  <th className="colWide">wpm</th>
                  <th className="colWide">accuracy</th>
                  <th className="colStacked">
                    <div>wpm</div>
                    <div className="second">accuracy</div>
                  </th>
                  <th className="colWide">raw</th>
                  <th className="colWide">consistency</th>
                  <th className="colStacked colRaw">
                    <div>raw</div>
                    <div className="second">consistency</div>
                  </th>
                  <th className="colTest">test</th>
                  <th>date</th>
                </tr>
              </thead>
              {visible.length > 0 && (
                <tbody>
                  {visible.map((r, i) => {
                    const rank = current * PAGE_SIZE + i + 1;
                    return (
                      <tr key={`${r.timestamp}-${i}`}>
                        <td className="rank">{rank === 1 ? <i className="fas fa-crown" /> : rank}</td>
                        <td className="name">
                          <div className="lbUser">
                            <i className="fas fa-user-circle avatar" />
                            <span>you</span>
                            {rank === 1 && (
                              <div className="lbBadge">
                                <i className="fas fa-rocket" />
                                <span>top run</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="colWide">{r.wpm.toFixed(2)}</td>
                        <td className="colWide">{pct(r.acc)}</td>
                        <td className="colStacked stacked">
                          <div>{r.wpm.toFixed(2)}</div>
                          <div className="second">{pct(r.acc)}</div>
                        </td>
                        <td className="colWide">{r.raw.toFixed(2)}</td>
                        <td className="colWide">{pct(r.consistency)}</td>
                        <td className="colStacked colRaw stacked">
                          <div>{r.raw.toFixed(2)}</div>
                          <div className="second">{pct(r.consistency)}</div>
                        </td>
                        <td className="colTest">
                          <div className="twoLine">
                            <div>{testLabel(r)}</div>
                            <div className="second">{testDetail(r)}</div>
                          </div>
                        </td>
                        <td>
                          <div className="twoLine">
                            <div>{formatDate(r.timestamp)}</div>
                            <div className="second">{formatClock(r.timestamp)}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>

          {visible.length === 0 && (
            <div className="lbEmpty">
              <i className="fas fa-microphone-alt emptyIcon" />
              <div className="emptyText">no results yet - go talk!</div>
              <div>
                {all.length === 0
                  ? "Finish a test and your best runs will show up here."
                  : `You haven't finished a ${boardSpec.label} test ${period === "allTime" ? "yet" : period === "weekly" ? "this week" : "today"}.`}
              </div>
              <button type="button" className="button" onClick={() => startBoard(board)}>
                <i className="fas fa-microphone" />
                start a test
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
