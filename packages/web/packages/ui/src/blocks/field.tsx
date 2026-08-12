import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { Label } from "../components/label"
import { FieldFootnote } from "../components/field-footnote"
import { fieldCaptionClass } from "../lib/typography"

// The family's standard form row: an uppercase-mono caption above its control,
// wrapped in the shared Label so the caption is implicitly associated with the
// input it contains. Below it, `FieldFootnote` renders the `error` if there is one
// and the `hint` otherwise, so forms stop re-implementing inline error text.
// Compose with the Input/Select/Switch/Textarea primitives.
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

// The footnote's home is `components/` (blocks compose components, never the other
// way round — `rdid-editor` is a component and needs it too), and it is re-exported
// here because this block's subpath is where the controls that cannot use `Field`
// already import it from.
export { FieldFootnote } from "../components/field-footnote"
