const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Splits a duration into a display value and unit, like monkeytype's "1444 years". */
export function formatDuration(seconds: number): { value: string; unit: string } {
  if (seconds < 60)
    return { value: String(Math.round(seconds)), unit: Math.round(seconds) === 1 ? "second" : "seconds" };
  const minutes = seconds / 60;
  if (minutes < 60) return { value: trimNumber(minutes), unit: "minutes" };
  const hours = minutes / 60;
  return { value: trimNumber(hours), unit: "hours" };
}

function trimNumber(n: number): string {
  return n >= 100 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toString();
}

export function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
