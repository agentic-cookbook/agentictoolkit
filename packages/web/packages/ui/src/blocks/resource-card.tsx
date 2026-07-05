import * as React from "react"
import type { ReactNode } from "react"

import { cn } from "../lib/utils"

// The /home resource card (ecosystem / application / persona): a name, an
// optional reverse-domain identifier (mono), a description, and a `meta` row
// (mono-dim chips with icons — region, domain, …). Clickable when `onClick` set.
// Stays a <div> (with role=button + keyboard support when interactive) so the
// block content (description <p>, meta <div>) is valid — a native <button>
// cannot contain block elements.
export function ResourceCard({
  title,
  identifier,
  description,
  meta,
  onClick,
  className,
}: {
  title: ReactNode
  identifier?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const interactive = Boolean(onClick)
  return (
    <div
      {...(interactive
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            },
          }
        : {})}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-apt-border bg-apt-surface p-5 text-left transition-colors",
        interactive &&
          "cursor-pointer outline-none hover:border-apt-border-strong hover:bg-apt-surface-2 focus-visible:border-apt-gold/60",
        className,
      )}
    >
      <div className="space-y-0.5">
        <div className="font-medium text-apt-text">{title}</div>
        {identifier && (
          <div className="font-mono text-xs text-apt-text-muted">{identifier}</div>
        )}
      </div>
      {description && (
        <p className="line-clamp-3 text-sm text-apt-text-muted">{description}</p>
      )}
      {meta && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-apt-text-dim">
          {meta}
        </div>
      )}
    </div>
  )
}
