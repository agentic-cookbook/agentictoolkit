"use client"

import type { MouseEvent as ReactMouseEvent } from "react"

import { cn } from "../lib/utils"

/**
 * The bare collapse/expand control for a rail or column — the «/» glyph button
 * shared by TopicDetail and the theme-editor's ColumnList. Not a full
 * {@link Disclosure} section: just the toggle to drop into a custom collapsible
 * layout. `label` names the region ("topic list", a column title) so the
 * accessible name reads "Collapse {label}" / "Expand {label}".
 */
export function CollapseToggle({
  collapsed,
  onToggle,
  label,
  controls,
  className,
}: {
  collapsed: boolean
  /** The click event is forwarded so a caller can read its modifier keys — the hierarchical stack
   *  treats ⌘/Ctrl-click as "apply this toggle to every list". Callers that don't care ignore it. */
  onToggle: (e: ReactMouseEvent<HTMLButtonElement>) => void
  /** Region name; the accessible label is "Collapse {label}" / "Expand {label}". */
  label: string
  /** id of the region this toggle controls (aria-controls). */
  controls?: string
  className?: string
}) {
  const text = `${collapsed ? "Expand" : "Collapse"} ${label}`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={text}
      aria-expanded={!collapsed}
      aria-controls={controls}
      title={text}
      className={cn(
        "rounded px-1 font-mono text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        className,
      )}
    >
      {collapsed ? "»" : "«"}
    </button>
  )
}
