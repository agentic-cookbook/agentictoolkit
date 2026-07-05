import type { ReactNode } from "react"

import { cn } from "../lib/utils"

// A horizontal control strip for text-editor surfaces (the row above a
// MarkdownEditor's textarea). Pure layout + the correct `role="toolbar"` /
// `aria-label` semantics so consumers stop re-deriving toolbar a11y. No hooks,
// so it stays server-safe (no "use client").
export function EditorToolbar({
  ariaLabel = "Editor toolbar",
  className,
  children,
}: {
  /** Accessible name for the toolbar (announced by assistive tech). */
  ariaLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-1.5", className)}
    >
      {children}
    </div>
  )
}
