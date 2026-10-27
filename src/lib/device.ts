export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

const IN_APP: [RegExp, string][] = [
  [/Twitter|TwitterAndroid/i, "x"],
  [/Instagram/i, "instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "facebook"],
  [/musical_ly|TikTok|Bytedance/i, "tiktok"],
  [/LinkedInApp/i, "linkedin"],
  [/Snapchat/i, "snapchat"],
  [/\bLine\//i, "line"],
  [/Discord/i, "discord"],
];

/** Name of the social app whose built-in browser we're in (these often block mic/speech APIs). */
export function inAppBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  for (const [re, name] of IN_APP) if (re.test(ua)) return name;
  return null;
}

export function isIOS(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
