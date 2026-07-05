import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "../lib/utils"
import { TONE_TEXT_CLASS, type Tone } from "../lib/tone"

// The glowing status dot — the family's "live light". The tone class sets
// currentColor and both the fill AND the soft glow derive from it, so one
// class drives the whole treatment. Sized in px (not a scale step) because it
// must optically align with mono text at many sizes.
//
// Tones come from the ONE family table (lib/tone) — except `neutral`: a neutral
// status dot is a de-emphasized indicator (dim), NOT the full-strength reading a
// neutral Stat value is, so it overrides just that one entry (documented,
// conformance-tested in status-dot.md T6).
const statusDotVariants = cva("inline-block shrink-0 rounded-full", {
  variants: {
    tone: { ...TONE_TEXT_CLASS, neutral: "text-apt-text-muted" },
  },
  defaultVariants: { tone: "neutral" },
})

/** A StatusDot's tone — the family tone vocabulary (shared with Stat). */
export type StatusDotTone = Tone

export interface StatusDotProps {
  tone?: StatusDotTone
  /** Diameter in px; the glow scales with it so a big dot still reads as a
   *  soft light, not a flat disc. */
  size?: number
  /** Accessible name (e.g. the status word). Omit for a purely decorative dot
   *  next to visible text — it is then aria-hidden. */
  label?: string
  className?: string
}

// Memoized: all props are primitives, so on a ticking parent (the fleet page
// re-renders every 1s) an unchanged dot skips re-rendering entirely instead of
// rebuilding its glow + style object each tick.
export const StatusDot = React.memo(function StatusDot({
  tone,
  size = 10,
  label,
  className,
}: StatusDotProps) {
  const glow = Math.max(6, Math.round(size * 0.55))
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(statusDotVariants({ tone }), className)}
      style={{
        width: size,
        height: size,
        background: "currentColor",
        boxShadow: `0 0 ${glow}px color-mix(in srgb, currentColor 40%, transparent)`,
      }}
    />
  )
})
