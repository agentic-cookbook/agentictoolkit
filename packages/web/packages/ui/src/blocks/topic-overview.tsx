"use client"

import type { ReactElement } from "react"

import { Card, CardHeader, CardTitle, CardDescription } from "../components/card"
import type { TopicDetailItem } from "./topic-detail"

/**
 * The STANDARD no-selection detail for a topic list: one card per topic — the topic's
 * icon + label with its `description` under it — laid out in a responsive grid.
 * Clicking a card selects that topic in the list (`onSelect` is the level's own
 * select). Hosts get it for free wherever a topic rail is the frontier with nothing
 * chosen, instead of a bare "Select a topic." placeholder.
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
                  <CardTitle className="flex items-center gap-2 text-apt-text">
                    <span aria-hidden className="shrink-0 text-apt-text-muted">
                      {it.icon}
                    </span>
                    {it.label}
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
