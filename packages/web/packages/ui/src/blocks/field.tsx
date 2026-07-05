import type { ReactNode } from "react"

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
      {error ? (
        <span className="font-mono text-[0.7rem] text-apt-red">{error}</span>
      ) : (
        hint && <span className="font-mono text-[0.7rem] text-apt-text-dim">{hint}</span>
      )}
    </Label>
  )
}
