"use client"

import type { ReactElement, ReactNode } from "react"

import { Card, CardHeader, CardTitle, CardDescription } from "../components/card"
import type { TopicDetailItem } from "./topic-detail"

/**
 * The OPT-IN no-selection detail for a topic list (`TopicLevel.overview: "cards"`): one
 * card per topic — the topic's icon + label with its `description` under it — laid out
 * in a responsive grid. Clicking a card selects that topic in the list (`onSelect` is
 * the level's own select). For a level whose card grid IS its landing page (the help
 * site's topic browser); everywhere else the default no-selection detail is the quiet
 * `TopicSelectHint` nudge.
 */
export function TopicOverview({
  title,
  items,
  onSelect,
}: {
  /** Optional heading above the grid (e.g. the owning entity's name). */
  title?: string
  items: TopicDetailItem[]
  onSelect: (id: string) => void
}): ReactElement {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 px-6 pt-6 pb-6">
        {title && (
          <h2 className="font-mono text-sm font-semibold tracking-[0.02em] text-apt-text">
            {title}
          </h2>
        )}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              className="group rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/60"
            >
              <Card className="h-full gap-2 transition-colors group-hover:border-apt-gold/60">
                <CardHeader>
                  {/* `items-start` + `leading-snug` + `break-words`/`anywhere` let a long
                      label (a full domain has no spaces to wrap on) wrap cleanly across
                      lines INSIDE the card instead of overflowing/clipping at its edge —
                      the icon stays pinned to the first line. `min-w-0` is what lets the
                      label wrap rather than force the flex row wider than the card. */}
                  <CardTitle className="flex items-start gap-2 leading-snug text-apt-text">
                    <span aria-hidden className="mt-0.5 shrink-0 text-apt-text-muted">
                      {it.icon}
                    </span>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{it.label}</span>
                  </CardTitle>
                  {it.description && (
                    <CardDescription className="text-sm text-apt-text-muted">
                      {it.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The no-selection detail for a topic list whose rows are all the SAME KIND of thing
 * (a Sites list, a Groups list) — a card grid of 100+ near-identical rows is noise, so
 * instead show one centered, readable blurb explaining what the items are and how to
 * choose one. Opt in per level with `TopicLevel.overviewHelp` (the blurb content is the
 * host's — a string or richer nodes); this component only owns the centered framing.
 */
export function TopicOverviewHelp({
  title,
  children,
}: {
  /** Optional heading (e.g. the list's name), shown above the blurb. */
  title?: string
  /** The customizable help content — what these items are and why you'd pick one. */
  children: ReactNode
}): ReactElement {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6">
      <div className="flex max-w-prose flex-col items-center gap-3 text-center">
        {title && (
          <h2 className="font-mono text-sm font-semibold tracking-[0.02em] text-apt-text">
            {title}
          </h2>
        )}
        <div className="text-sm leading-relaxed text-apt-text-muted [&_strong]:font-semibold [&_strong]:text-apt-text">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * The DEFAULT no-selection detail: an almost-empty pane holding one quiet, centered nudge
 * to pick something from the list. The pane owns no content of its own until a real choice
 * is made — a level whose cards are a genuine landing opts back into the `TopicOverview`
 * grid with `overview: "cards"`, and `overviewHelp` still supplies a richer custom blurb.
 * `data-htd-select-hint` is the stable hook for tests, so they never couple to the copy.
 */
export function TopicSelectHint(): ReactElement {
  return (
    <div
      data-htd-select-hint
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6"
    >
      <p className="max-w-prose text-center text-sm leading-relaxed text-apt-text-muted">
        Select an item from the list to view or edit it here.
      </p>
    </div>
  )
}
