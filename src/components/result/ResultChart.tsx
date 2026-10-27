import { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { TestResult } from "../../store/test";

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip);

interface ThemeColors {
  main: string;
  sub: string;
  subAlt: string;
  error: string;
  font: string;
}

function readColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    main: v("--main-color", "#e2b714"),
    sub: v("--sub-color", "#646669"),
    subAlt: v("--sub-alt-color", "#2c2e31"),
    error: v("--error-color", "#ca4754"),
    font: v("--font", "Roboto Mono, monospace"),
  };
}

function sameColors(a: ThemeColors, b: ThemeColors) {
  return a.main === b.main && a.sub === b.sub && a.subAlt === b.subAlt && a.error === b.error && a.font === b.font;
}

/** Theme colors are inline styles on <html>, so watch them to recolor live (theme previews included). */
function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const update = () => setColors((prev) => {
      const next = readColors();
      return sameColors(prev, next) ? prev : next;
    });
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    update();
    return () => obs.disconnect();
  }, []);
  return colors;
}

let colorCtx: CanvasRenderingContext2D | null = null;

function withAlpha(color: string, alpha: number): string {
  colorCtx ??= document.createElement("canvas").getContext("2d");
  if (!colorCtx) return color;
  colorCtx.fillStyle = "#000";
  colorCtx.fillStyle = color;
  const norm = String(colorCtx.fillStyle);
  if (norm.startsWith("#") && norm.length === 7) {
    const r = parseInt(norm.slice(1, 3), 16);
    const g = parseInt(norm.slice(3, 5), 16);
    const b = parseInt(norm.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const m = norm.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${Number(a) * alpha})`;
}

interface Visibility {
  raw: boolean;
  burst: boolean;
  errors: boolean;
  startAtZero: boolean;
}

export function ResultChart({ result }: { result: TestResult }) {
  const colors = useThemeColors();
  const [vis, setVis] = useState<Visibility>({ raw: true, burst: true, errors: true, startAtZero: true });

  const series = useMemo(() => {
    const { labels, wpm, raw, burst, err } = result.chart;
    return {
      labels: labels.map((l) => String(l)),
      wpm: wpm.map((v) => Math.round(v)),
      raw: raw.map((v) => Math.round(v)),
      burst: burst.map((v) => Math.round(v)),
      err,
    };
  }, [result]);

  const data = useMemo<ChartData<"line", number[], string>>(() => {
    const errorRadius = (r: number) => (ctx: ScriptableContext<"line">) =>
      ((ctx.raw as number | undefined) ?? 0) <= 0 ? 0 : r;
    return {
      labels: series.labels,
      datasets: [
        {
          label: "wpm",
          data: series.wpm,
          clip: false,
          borderColor: colors.main,
          backgroundColor: "transparent",
          pointBackgroundColor: colors.main,
          pointBorderColor: colors.main,
          borderWidth: 3,
          pointRadius: 1,
          yAxisID: "wpm",
          order: 2,
        },
        {
          label: "raw",
          data: series.raw,
          hidden: !vis.raw,
          clip: false,
          borderColor: withAlpha(colors.main, 0.6),
          backgroundColor: "transparent",
          pointBackgroundColor: withAlpha(colors.main, 0.6),
          pointBorderColor: withAlpha(colors.main, 0.6),
          borderWidth: 2,
          borderDash: [8, 8],
          pointRadius: 0,
          yAxisID: "raw",
          order: 3,
        },
        {
          label: "errors",
          data: series.err,
          hidden: !vis.errors,
          clip: false,
          showLine: false,
          fill: false,
          borderColor: colors.error,
          backgroundColor: colors.error,
          pointBackgroundColor: colors.error,
          pointBorderColor: colors.error,
          borderWidth: 2,
          pointStyle: "crossRot",
          pointRadius: errorRadius(3),
          pointHoverRadius: errorRadius(5),
          yAxisID: "error",
          order: 1,
        },
        {
          label: "burst",
          data: series.burst,
          hidden: !vis.burst,
          clip: false,
          fill: "origin",
          borderColor: colors.sub,
          backgroundColor: withAlpha(colors.subAlt, 0.5),
          pointBackgroundColor: colors.sub,
          pointBorderColor: colors.sub,
          borderWidth: 3,
          pointRadius: 1,
          yAxisID: "burst",
          order: 4,
        },
      ],
    };
  }, [series, colors, vis.raw, vis.burst, vis.errors]);

  const options = useMemo<ChartOptions<"line">>(() => {
    const visibleLines = [series.wpm, vis.raw ? series.raw : [], vis.burst ? series.burst : []].flat();
    const maxVal = Math.max(1, ...visibleLines);
    const max = Math.ceil(maxVal / 10) * 10;
    const min = vis.startAtZero ? 0 : Math.max(0, Math.floor(Math.min(...visibleLines, max) / 10) * 10);
    const errMax = Math.max(1, ...series.err);
    const font = { family: colors.font, size: 12, lineHeight: 1.2 };
    const tickBase = {
      color: colors.sub,
      font,
      autoSkip: true,
      autoSkipPadding: 20,
      padding: 3,
    };
    const grid = {
      color: colors.subAlt,
      tickColor: colors.subAlt,
      lineWidth: 1,
      tickLength: 8,
    };
    const border = { color: colors.subAlt, width: 1 };
    const title = (text: string, display = true) => ({
      display,
      text,
      color: colors.sub,
      font,
      padding: { top: 4, bottom: 4 },
    });
    const hiddenWpmAxis = (text: string) => ({
      display: false,
      beginAtZero: true,
      min,
      max,
      title: title(text),
      ticks: tickBase,
      grid: { ...grid, display: false },
    });
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: "nearest", intersect: true },
      hover: { mode: "nearest", intersect: true },
      elements: {
        line: { tension: 0.5, fill: "origin" },
        point: { hoverRadius: 4, hitRadius: 1 },
      },
      layout: { padding: 0 },
      scales: {
        x: {
          type: "category",
          ticks: { ...tickBase, minRotation: 0, maxRotation: 50 },
          grid,
          border,
          title: title("Seconds", false),
        },
        wpm: {
          type: "linear",
          position: "left",
          display: true,
          beginAtZero: true,
          min,
          max,
          title: title("Words per Minute"),
          ticks: tickBase,
          grid,
          border,
        },
        raw: { type: "linear", position: "left", ...hiddenWpmAxis("Raw Words per Minute") },
        burst: { type: "linear", position: "left", ...hiddenWpmAxis("Burst Words per Minute") },
        error: {
          type: "linear",
          position: "right",
          display: true,
          beginAtZero: true,
          min: 0,
          max: errMax,
          title: title("Errors"),
          ticks: { ...tickBase, precision: 0 },
          grid: { ...grid, display: false },
          border,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          position: "average",
          animation: { duration: 250 },
          backgroundColor: "rgba(0,0,0,0.8)",
          titleColor: "#fff",
          titleFont: { ...font, weight: "bold" },
          titleAlign: "left",
          titleSpacing: 2,
          titleMarginBottom: 6,
          bodyColor: "#fff",
          bodyFont: font,
          bodyAlign: "left",
          bodySpacing: 2,
          footerFont: { ...font, weight: "bold" },
          padding: 6,
          caretPadding: 2,
          caretSize: 5,
          cornerRadius: 6,
          multiKeyBackground: "#fff",
          displayColors: true,
          boxWidth: 12,
          boxHeight: 12,
          boxPadding: 0,
          borderWidth: 0,
        },
      },
    };
  }, [series, colors, vis]);

  const toggle = (key: keyof Visibility) => setVis((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="resultChart">
      <div className="chartLegend">
        <button
          type="button"
          tabIndex={-1}
          className={`textButton ${vis.startAtZero ? "" : "active"}`}
          onClick={() => toggle("startAtZero")}
        >
          <i className="fas fa-chart-line" />
          scale
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`textButton ${vis.raw ? "" : "off"}`}
          onClick={() => toggle("raw")}
        >
          <div className="legendLine dashed" />
          <div>raw</div>
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`textButton ${vis.burst ? "" : "off"}`}
          onClick={() => toggle("burst")}
        >
          <div className="legendLine burst" />
          <div>burst</div>
        </button>
        <button
          type="button"
          tabIndex={-1}
          className={`textButton ${vis.errors ? "" : "off"}`}
          onClick={() => toggle("errors")}
        >
          <i className="fas fa-times legendErrors" />
          <div>errors</div>
        </button>
      </div>
      <div className="chartCanvasWrap">
        <Chart type="line" data={data} options={options} />
      </div>
    </div>
  );
}
