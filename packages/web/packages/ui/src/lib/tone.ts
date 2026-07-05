// The family status-tone vocabulary — ONE home for the tone → text-color map so
// Stat, StatusDot, and any site that must tint non-Stat text (a status word, a
// lucide icon) all read from the same table instead of hand-rolling parallel
// `status → text-apt-*` maps (the drift the 2026-07 review found in the fleet
// site). `neutral` here is the primary reading strength (a stat value);
// components that treat neutral as de-emphasized (StatusDot) override just that
// one entry when they build their cva.

export type Tone =
  | "neutral"
  | "muted"
  | "accent"
  | "blue"
  | "orange"
  | "success"
  | "error"

/** Tone → the text-color utility that paints it. The authoritative table. */
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  neutral: "text-apt-text",
  muted: "text-apt-text-dim",
  accent: "text-apt-gold",
  blue: "text-apt-blue",
  orange: "text-apt-orange",
  success: "text-apt-green",
  error: "text-apt-red",
}

/** The text-color class for a family tone — the one home a site reaches for
 *  when it must tint text or an icon by tone (a status word, a lucide glyph),
 *  the class-recipe analogue of `buttonVariants` / `railLinkVariants`. */
export function toneTextClass(tone: Tone = "neutral"): string {
  return TONE_TEXT_CLASS[tone]
}
