import * as React from "react"

import { noAutofillPropsFor } from "../lib/autofill"
import { cn } from "../lib/utils"

// The one home for the form-control shell (border + radius + field surface).
// Every field-shaped control — Input/Textarea/Select, the choosers, chip
// boxes, segmented toggles — composes this, so the field look changes in
// exactly one place.
export const fieldShellClass = "rounded-lg border border-apt-border bg-apt-bg"

// Themed with the family `apt-*` token utilities (mapped to the M3 role vars
// injected by <AdhThemeStyle/>), to match the sibling Textarea/Select/Card.
function Input({ className, type, autoComplete, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      // Password managers stay out of an adh field unless it names an autofill
      // token — see lib/autofill. `autoComplete` is destructured OUT of `props`
      // rather than read off it, so it is stated exactly once: a caller passing
      // it explicitly as `undefined` (which is what `<Input autoComplete={x}/>`
      // does whenever `x` is optional and absent) would otherwise re-apply it
      // through `{...props}` below and delete the bag's own `off` — leaving the
      // five vendor attributes and no instruction to the browser at all.
      // A real token still wins, because it is written before the spread and
      // the helper returns nothing to overwrite it with.
      autoComplete={autoComplete}
      {...noAutofillPropsFor(autoComplete)}
      className={cn(
        fieldShellClass,
        "flex h-9 w-full min-w-0 px-3 py-2 text-sm text-apt-text transition-colors outline-none",
        "placeholder:text-apt-text-dim selection:bg-apt-gold/30",
        "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-apt-red aria-invalid:ring-2 aria-invalid:ring-apt-red/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
