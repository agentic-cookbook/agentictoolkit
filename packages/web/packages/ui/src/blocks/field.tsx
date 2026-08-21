import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { Label } from "../components/label"
import { FieldFootnote } from "../components/field-footnote"
import { fieldCaptionClass } from "../lib/typography"

// The family's standard form row: a caption and its control, wrapped in the shared
// Label so the caption is implicitly associated with the input it contains. Below it,
// `FieldFootnote` renders the `error` if there is one and the `hint` otherwise, so
// forms stop re-implementing inline error text. Compose with the Input/Select/Switch/
// Textarea primitives.
//
// Two layouts. `"stacked"` (the default, and every existing caller) puts the caption
// ABOVE the control. `"inline"` puts it BESIDE it, in a fixed-width right-aligned
// column — for a GROUP of short-captioned rows that should read as a table
// ("Categories: […]" over "Tags: […]"). The column's width is the
// `--apt-field-label-w` custom property rather than a prop, because alignment is a
// property of the GROUP: a wrapper sets it once and every inline field inside lines
// up, without any field having to know what its neighbours are called.
export function Field({
  label,
  hint,
  error,
  layout = "stacked",
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  /** Inline error message; shown in place of `hint` when set. */
  error?: ReactNode
  /** Caption above the control (default) or beside it in the shared label column. */
  layout?: "stacked" | "inline"
  className?: string
  children: ReactNode
}) {
  const inline = layout === "inline"
  return (
    <Label
      className={cn(
        inline
          ? "grid w-full grid-cols-[var(--apt-field-label-w,8rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1"
          : "flex flex-col items-start gap-1.5",
        className,
      )}
    >
      <span className={cn(fieldCaptionClass, inline && "justify-self-end text-right")}>
        {label}
      </span>
      {/* Inline mode wraps the control in ONE cell: a caller may pass several children
          (CategoryField passes its control row AND its rename Dialog), and in a grid each
          of those would claim a column of its own. */}
      {inline ? <div className="flex min-w-0 flex-col gap-2">{children}</div> : children}
      <FieldFootnote
        hint={hint}
        error={error}
        className={inline ? "col-start-2" : undefined}
      />
    </Label>
  )
}

// The footnote's home is `components/` (blocks compose components, never the other
// way round — `rdid-editor` is a component and needs it too), and it is re-exported
// here because this block's subpath is where the controls that cannot use `Field`
// already import it from.
export { FieldFootnote } from "../components/field-footnote"
