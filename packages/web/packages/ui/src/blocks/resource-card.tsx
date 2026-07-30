import * as React from "react"
import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { DefaultDocLink } from "./doc-link"
import type { DocLinkComponent } from "./doc-types"

// The /home resource card (ecosystem / application / persona): a name, an
// optional reverse-domain identifier (mono), a description, and a `meta` row
// (mono-dim chips with icons — region, domain, …).
//
// Three roots, chosen by which prop the host passes:
//
//   * `href` — a real anchor, because a card that goes somewhere must BE a link:
//     middle-click, ⌘-click, "copy link", the status bar on hover, and the
//     browser's own history all come from the element, not from a handler. A host
//     with a router passes `LinkComponent` (a three-line adapter around next/link
//     or similar); without one it falls back to a plain `<a href>`.
//   * `onClick` — a `<div role="button">` with Enter/Space, for a card that ACTS
//     rather than navigates. It stays a div because the block content below
//     (description `<p>`, meta `<div>`) is not valid inside a native `<button>`.
//     An `<a>` has no such restriction: anchors take flow content, so the `href`
//     root above nests the same children legitimately.
//   * neither — an inert `<div>`.
//
// `href` wins if both are passed; an `onClick` alongside it still fires, ahead of
// the navigation, which is the least surprising reading of "a link that also does
// something".
export function ResourceCard({
  title,
  identifier,
  description,
  meta,
  onClick,
  href,
  LinkComponent = DefaultDocLink,
  className,
}: {
  title: ReactNode
  identifier?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  onClick?: () => void
  /** Destination. Set this to make the whole card a real link. */
  href?: string
  /**
   * The host's router link, used only when `href` is set. Named `to` rather than
   * `href` to match the family's one injection convention (`DocLinkComponent`),
   * so a host writes a single adapter for every block that takes one.
   */
  LinkComponent?: DocLinkComponent
  className?: string
}) {
  const navigational = href !== undefined
  const interactive = navigational || Boolean(onClick)

  const classes = cn(
    "flex w-full flex-col gap-2 rounded-xl border border-apt-border bg-apt-surface p-5 text-left transition-colors",
    interactive &&
      "cursor-pointer outline-none hover:border-apt-border-strong hover:bg-apt-surface-2 focus-visible:border-apt-gold/60",
    className,
  )

  const body = (
    <>
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
    </>
  )

  if (navigational) {
    return (
      <LinkComponent to={href} onClick={onClick} className={classes}>
        {body}
      </LinkComponent>
    )
  }

  return (
    <div
      {...(onClick
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
      className={classes}
    >
      {body}
    </div>
  )
}
