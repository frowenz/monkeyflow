import { isTouchDevice } from "./device";
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

function canCopyImage(): boolean {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  const supports = (ClipboardItem as { supports?: (type: string) => boolean }).supports;
  return typeof supports !== "function" || supports("image/png");
}

export type ScreenshotOutcome = "copied" | "shared" | "downloaded" | "cancelled";

/**
 * Copies the PNG to the clipboard; where that isn't possible but the Web Share
 * API takes files (mobile), opens the share sheet; otherwise downloads it.
 * The ClipboardItem is created synchronously with a pending blob so Safari
 * keeps the user gesture.
 */
export async function copyImageOrDownload(
  blob: Promise<Blob>,
  filename: string,
  forceDownload = false,
  share?: { title?: string; text?: string },
): Promise<ScreenshotOutcome> {
  // On phones the share sheet (straight into the X app) beats a clipboard image.
  const preferShare = !forceDownload && isTouchDevice() && typeof navigator.canShare === "function";
  if (preferShare) {
    const file = new File([await blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ ...share, files: [file] });
        return "shared";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      }
    }
  }
  if (!forceDownload && canCopyImage()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
      // fall through to share / download
    }
  }
  const png = await blob;
  if (!forceDownload && !preferShare && typeof navigator.canShare === "function") {
    const file = new File([png], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ ...share, files: [file] });
        return "shared";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
        // gesture expired or share target failed: download instead
      }
    }
  }
  downloadBlob(png, filename);
  return "downloaded";
}

export function screenshotFilename(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `monkeyflow-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}
