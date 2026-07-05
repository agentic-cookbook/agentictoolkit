import * as React from "react"

import { cn } from "../lib/utils"

// The "{label} ↗" deep link — an anchor that opens in a new tab (noopener) with
// a trailing arrow affordance. The default skin is the dashboard deep-link
// grammar (small mono, info-blue); consumers restyle via className (cn-merged)
// or drop the arrow (`glyph={false}`) when a leading icon carries the meaning.
export function ExternalLink({
  className,
  glyph = true,
  children,
  ...props
}: React.ComponentProps<"a"> & { glyph?: boolean }) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-1 rounded-sm font-mono text-[11px] whitespace-nowrap text-apt-blue no-underline outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        className,
      )}
      {...props}
      // target/rel come AFTER the spread so a caller can never accidentally drop
      // the safe-new-tab contract this component exists to guarantee (a
      // caller-supplied `rel`/`target` in props would otherwise win and reopen
      // the reverse-tabnabbing hole).
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      {glyph && <span aria-hidden="true">↗</span>}
    </a>
  )
}
