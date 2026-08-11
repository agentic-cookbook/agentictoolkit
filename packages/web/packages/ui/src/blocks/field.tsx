import type { ReactElement, ReactNode } from "react"

import { cn } from "../lib/utils"
import { Label } from "../components/label"
import { fieldCaptionClass } from "../lib/typography"

// The family's standard form row: an uppercase-mono caption above its control,
// wrapped in the shared Label so the caption is implicitly associated with the
// input it contains. An optional `hint` sits below (dim mono); an `error` (red
// mono) takes its place when present, so forms stop re-implementing inline error
// text. Compose with the Input/Select/Switch/Textarea primitives.
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  /** Inline error message; shown in place of `hint` when set. */
  error?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Label className={cn("flex flex-col items-start gap-1.5", className)}>
      <span className={fieldCaptionClass}>
        {label}
      </span>
      {children}
      <FieldFootnote hint={hint} error={error} />
    </Label>
  )
}

/**
 * The hint/error line under a control, on its own so the one control that CANNOT
 * use {@link Field} still reports its problem in the same place and the same words.
 * A checkbox reads as "[box] label" rather than as a caption above a control, so it
 * builds its own row (see `@agentic-toolkit/editing`'s bound controls) — and a
 * second copy of these two spans is how one of them ends up missing a fix made to
 * the other.
 */
export function FieldFootnote({
  hint,
  error,
}: {
  hint?: ReactNode
  /** Shown in place of `hint` when set. */
  error?: ReactNode
}): ReactElement | null {
  if (error) return <span className="font-mono text-[0.7rem] text-apt-red">{error}</span>
  if (hint) return <span className="font-mono text-[0.7rem] text-apt-text-dim">{hint}</span>
  return null
}
