import { useLayoutEffect, useRef, useState } from "react";

const BUCKET = 10;
const MIN_BUCKETS = 20;
const CHAR_W = 7.2;
const PAD_TOP = 10;
const AXIS_W = 60;

function niceStep(max: number): number {
  const raw = Math.max(1, max / 3);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return Math.max(1, Math.round(nice * pow));
}

export function WpmHistogram({ values, height = 192 }: { values: number[]; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const top = values.length ? Math.max(...values) : 0;
  const bucketCount = Math.max(MIN_BUCKETS, Math.floor(top / BUCKET) + 1);
  const counts = new Array<number>(bucketCount).fill(0);
  for (const v of values) counts[Math.min(bucketCount - 1, Math.max(0, Math.floor(v / BUCKET)))]++;
  const labels = counts.map((_, i) => `${i * BUCKET} - ${i * BUCKET + BUCKET - 1}`);

  const maxCount = Math.max(...counts);
  const step = niceStep(maxCount);
  const yMax = Math.max(maxCount, step * 3);
  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += step) ticks.push(t);

  const plotW = Math.max(0, width - AXIS_W);
  const slot = plotW / bucketCount;
  const longest = Math.max(...labels.map((l) => l.length)) * CHAR_W;
  const rotate = longest > slot * 0.9;
  const labelEvery = rotate ? Math.max(1, Math.ceil(40 / Math.max(slot, 1))) : 1;
  const labelH = rotate ? Math.min(60, longest * 0.5 + 12) : 22;
  const plotH = Math.max(40, height - PAD_TOP - labelH);
  const y = (v: number) => PAD_TOP + plotH - (v / yMax) * plotH;
  const barW = slot * 0.72;

  return (
    <div ref={boxRef} className="chartBox">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="distribution of your results">
          <g className="grid">
            {counts.map((_, i) => (
              <line key={`v${i}`} x1={AXIS_W + i * slot} x2={AXIS_W + i * slot} y1={PAD_TOP} y2={PAD_TOP + plotH} />
            ))}
            <line x1={AXIS_W + plotW} x2={AXIS_W + plotW} y1={PAD_TOP} y2={PAD_TOP + plotH} />
            {ticks.map((t) => (
              <line key={`h${t}`} x1={AXIS_W} x2={AXIS_W + plotW} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <text
            x={12}
            y={PAD_TOP + plotH / 2}
            transform={`rotate(-90 12 ${PAD_TOP + plotH / 2})`}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            tests
          </text>
          {ticks.map((t) => (
            <text key={`t${t}`} x={AXIS_W - 10} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t.toLocaleString("en-US")}
            </text>
          ))}
          {counts.map((c, i) => {
            const h = (c / yMax) * plotH;
            return (
              <rect
                key={`b${i}`}
                className="bar"
                x={AXIS_W + i * slot + (slot - barW) / 2}
                y={PAD_TOP + plotH - h}
                width={barW}
                height={h}
              >
                <title>
                  {labels[i]} wpm: {c} {c === 1 ? "test" : "tests"}
                </title>
              </rect>
            );
          })}
          {labels.map((l, i) => {
            if (i % labelEvery !== 0) return null;
            const cx = AXIS_W + i * slot + slot / 2;
            const ly = PAD_TOP + plotH + 14;
            return rotate ? (
              <text key={`l${i}`} x={cx} y={ly} textAnchor="end" transform={`rotate(-30 ${cx} ${ly})`}>
                {l}
              </text>
            ) : (
              <text key={`l${i}`} x={cx} y={ly} textAnchor="middle">
                {l}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
