import type { HTMLAttributes, ReactNode } from "react"

import { StatusDot, type StatusDotTone } from "../components/status-dot"
import { cn } from "../lib/utils"

// The status list — a stack of "tone dot + truncating label + trailing figure"
// rows: the fleet/telemetry idiom (a monitor's down sites, a card's top error
// issues). Extracted so every "list of tone-dotted items with a trailing value"
// reads identically instead of being hand-rolled per site. Pure assembly of
// StatusDot + text; the caller owns the trailing content (a bold duration, a
// count + deep link).

export interface StatListRowProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Dot tone from the family tone scale. */
  tone?: StatusDotTone
  /** The truncating primary text (a monitor/site name, an issue title). */
  label: ReactNode
  /** Native tooltip for the (usually truncated) label. */
  labelTitle?: string
  /** Right-aligned trailing content — a bold value, or a count + deep link. */
  trailing?: ReactNode
  /** Row element: `li` inside a `ul` StatList, else `div`. */
  as?: "li" | "div"
}

export function StatListRow({
  tone,
  label,
  labelTitle,
  trailing,
  as: Tag = "div",
  className,
  ...rest
}: StatListRowProps) {
  return (
    <Tag className={cn("flex items-center gap-2 font-mono text-[11px]", className)} {...rest}>
      <StatusDot tone={tone} size={7} />
      <span title={labelTitle} className="min-w-0 flex-1 truncate text-apt-text-muted">
        {label}
      </span>
      {trailing != null && (
        <span className="inline-flex shrink-0 items-center gap-2">{trailing}</span>
      )}
    </Tag>
  )
}

export interface StatListProps extends HTMLAttributes<HTMLElement> {
  /** Adds the top divider + padding used when the list sits under card content. */
  divided?: boolean
  /** List element: `ul` (a semantic list of items) or `div`. */
  as?: "ul" | "div"
  children: ReactNode
}

export function StatList({
  divided = false,
  as: Tag = "div",
  className,
  children,
  ...rest
}: StatListProps) {
  return (
    <Tag
      className={cn(
        "flex list-none flex-col gap-1.5",
        divided && "border-t border-apt-border pt-2.5",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
