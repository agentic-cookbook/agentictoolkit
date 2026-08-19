import * as React from "react"

import { noAutofillPropsFor } from "../lib/autofill"
import { cn } from "../lib/utils"
import { fieldShellClass } from "./input"

// Themed with the family `apt-*` token utilities to match the sibling Input/Card.
function Textarea({ className, autoComplete, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      // Same opt-out as Input, destructured for the same reason — see
      // lib/autofill and Input's comment. A textarea is never a credential, but
      // managers still decorate one when the page reads like a form to them.
      autoComplete={autoComplete}
      {...noAutofillPropsFor(autoComplete)}
      className={cn(
        fieldShellClass,
        "flex min-h-16 w-full px-3 py-2 text-sm text-apt-text transition-colors outline-none",
        "placeholder:text-apt-text-dim",
        "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-apt-red aria-invalid:ring-2 aria-invalid:ring-apt-red/25",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
