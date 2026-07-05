import type { ReactNode } from "react"
import { cva } from "class-variance-authority"

import { cn } from "../lib/utils"
import { TONE_TEXT_CLASS, type Tone } from "../lib/tone"

// The stat grammar — one label/value pair rendered either as a row (label left,
// big value right; the dashboard-card form) or as a column (value over label;
// the hero-strip form). Extracted from the status board so every site's
// dashboard figures share one look. The value tints via the family status
// tokens (the ONE tone table in lib/tone); the label is the display
// micro-caption treatment.

const statValueVariants = cva("font-mono text-lg font-bold leading-none", {
  variants: { tone: TONE_TEXT_CLASS },
  defaultVariants: { tone: "neutral" },
})

/** A Stat's value tone — the family tone vocabulary (`neutral` = full-strength). */
export type StatTone = Tone

/** The stat label's micro-caption — smaller and dimmer than `fieldCaptionClass`
 *  (the FORM caption): a display label under/beside a figure, not a field name. */
const statLabelClass =
  "font-mono text-[10px] uppercase tracking-[0.06em] text-apt-text-dim"

export interface StatProps {
  label: ReactNode
  value: ReactNode
  /** Value tint from the family status tokens. */
  tone?: StatTone
  /** Extra classes for the value — the escape hatch for categorical hues. */
  valueClassName?: string
  className?: string
}

/** Label left, big value right on a shared baseline — the dashboard-card form. */
export function StatRow({ label, value, tone, valueClassName, className }: StatProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <span className={statLabelClass}>{label}</span>
      <span className={cn(statValueVariants({ tone }), valueClassName)}>{value}</span>
    </div>
  )
}

/** Big value over its label, right-aligned — the hero-strip form. */
export function Stat({ label, value, tone, valueClassName, className }: StatProps) {
  return (
    <div className={cn("flex flex-col items-end gap-px", className)}>
      <span className={cn(statValueVariants({ tone }), valueClassName)}>{value}</span>
      <span className={statLabelClass}>{label}</span>
    </div>
  )
}
