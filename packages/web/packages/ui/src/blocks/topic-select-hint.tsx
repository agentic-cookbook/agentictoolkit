"use client"

import type { ReactElement, ReactNode } from "react"

import { MousePointerClick } from "lucide-react"

import { Card } from "../components/card"

/** "a"/"an" for the nudge's noun — UI copy only, no attempt at fuller English rules. */
const article = (noun: string): string => (/^[aeiou]/i.test(noun) ? "an" : "a")

/**
 * THE "select something" placeholder — one centered card (assembled from the `Card`
 * primitive: icon chip, headline, optional blurb) shared by every pane that waits on a
 * choice: the stack's unselected frontier, master/detail leaves with no open row,
 * explorer landings. Every such blurb renders THIS, never a bare `<p>`/`EmptyState`,
 * so they all read the same (the dashed `EmptyState` stays the home for genuinely
 * empty/loading/error panes).
 *
 * The headline is `title` verbatim when given; otherwise it is built as specifically
 * as the frontier level allows — "Select a workspace" (`TopicLevel.itemNoun`), else
 * "Select an item from Workspaces" (the level's `title`), else the fully generic line.
 * `children` is the level's bespoke `overviewHelp` copy — WHAT one of these rows is and
 * WHY to choose one — rendered under the headline; with `selectable: false` (an empty
 * list) the blurb shows alone, since there is nothing to select yet and the rail already
 * shows the level's `emptyLabel`. There is no richer alternative to opt into: an
 * unselected frontier is this card and nothing else (docs/ui/fleet-ui-audit.md §1.5),
 * which is why the card-grid landing this file used to also export is gone.
 * `data-htd-select-hint` is the stable hook for tests, so they never couple to the copy.
 */
export function TopicSelectHint({
  title,
  noun,
  listTitle,
  selectable = true,
  children,
}: {
  /** Verbatim headline (e.g. "Select a group to edit, or create a new one."). Wins over
   *  the computed "Select …" line. */
  title?: ReactNode
  /** Singular noun for one row ("workspace", "site") — the most specific computed headline. */
  noun?: string
  /** The list's heading, the fallback subject when no noun is declared. */
  listTitle?: string
  /** False while the list has no rows: suppress the "Select …" line, show only the blurb. */
  selectable?: boolean
  /** The level's bespoke copy (`overviewHelp`): what these rows are and why to pick one. */
  children?: ReactNode
}): ReactElement {
  const subject = noun
    ? `${article(noun)} ${noun}`
    : listTitle
      ? `an item from ${listTitle}`
      : "an item from the list"
  const headline =
    title ?? (selectable ? `Select ${subject}${children == null ? " to view or edit it here." : ""}` : null)
  return (
    <div
      data-htd-select-hint
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6"
    >
      <Card className="w-full max-w-md items-center gap-3 px-8 py-10 text-center">
        <div
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full border border-apt-border bg-apt-surface text-apt-text-dim"
        >
          <MousePointerClick className="size-5" />
        </div>
        {headline != null && (
          <div className="font-semibold leading-snug text-apt-text">{headline}</div>
        )}
        {children != null && (
          <div className="text-sm leading-relaxed text-apt-text-muted [&_strong]:font-semibold [&_strong]:text-apt-text">
            {children}
          </div>
        )}
      </Card>
    </div>
  )
}
