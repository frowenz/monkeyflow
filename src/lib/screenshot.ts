
export interface CaptureOptions {
  backgroundColor: string;
  /** Space around the element in the output image, in CSS pixels. */
  padding?: number;
}

export async function captureElement(el: HTMLElement, opts: CaptureOptions): Promise<Blob> {
  const pad = opts.padding ?? 32;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const blob = await (await import("modern-screenshot")).domToBlob(el, {
    type: "image/png",
    backgroundColor: opts.backgroundColor,
    scale: Math.max(1, window.devicePixelRatio || 1),
    width: width + pad * 2,
    height: height + pad * 2,
    style: {
      boxSizing: "content-box",
      width: `${width}px`,
      height: `${height}px`,
      padding: `${pad}px`,
      margin: "0",
    },
  });
  if (!blob) throw new Error("screenshot produced no image");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies the PNG to the clipboard, falling back to a download. The ClipboardItem
 * is created synchronously with a pending blob so Safari keeps the user gesture.
 */
export async function copyImageOrDownload(
  blob: Promise<Blob>,
  filename: string,
  forceDownload = false,
): Promise<"copied" | "downloaded"> {
  if (!forceDownload && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
      // fall through to download
    }
  }
  downloadBlob(await blob, filename);
  return "downloaded";
}

export function screenshotFilename(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `monkeyflow-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}
