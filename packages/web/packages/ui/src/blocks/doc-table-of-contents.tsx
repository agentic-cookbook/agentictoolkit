"use client"

// The reader's right rail: "ON THIS PAGE", a scrollspy list of the document's
// own headings with a marker on whichever one you're reading.
//
// HDV has NO opinion about which headings belong here. Omit `excludeIds` and
// every heading is listed — the host decides that, say, a change-history heading
// is document chrome rather than part of the argument, and says so by id. Depth
// is honoured as indentation only; the list is flat, because a document's
// heading sequence already reads as its outline.

import type { HTMLAttributes, ReactNode } from "react"

import { useScrollSpy } from "../hooks/useScrollSpy"
import { cn } from "../lib/utils"
import type { HeadingEntry } from "./doc-types"

/** The sticky column, offset by one header. `var(--adh-header-height, 3.5rem)` rather
 *  than a literal: the adh header is a bar plus the preview strip above it, and the
 *  variable is where that sum lives. The fallback is the bar alone, for consumers of
 *  this package that mount no adh header. Same pair as `DOC_NAV_ASIDE_CLASS`. */
export const DOC_TABLE_OF_CONTENTS_CLASS =
  "hidden xl:block w-56 shrink-0 sticky top-[var(--adh-header-height,3.5rem)] h-[calc(100vh-var(--adh-header-height,3.5rem))] overflow-y-auto py-8 pr-4"

export interface DocTableOfContentsProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** The document's headings, in document order. Render nothing when empty. */
  headings: HeadingEntry[]
  /** Heading ids to leave out. Omit to list every heading. */
  excludeIds?: Iterable<string>
  /** The rail's own label. */
  title?: ReactNode
}

export function DocTableOfContents({
  headings,
  excludeIds,
  title = "On this page",
  className,
  ...rest
}: DocTableOfContentsProps) {
  const excluded = excludeIds ? new Set(excludeIds) : null
  const listed = excluded
    ? headings.filter((heading) => !excluded.has(heading.id))
    : headings

  const activeId = useScrollSpy(listed.map((heading) => heading.id))

  if (listed.length === 0) return null

  return (
    <aside className={cn(DOC_TABLE_OF_CONTENTS_CLASS, className)} {...rest}>
      <h4 className="font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-dim)] mb-3">
        {title}
      </h4>
      <ul className="flex flex-col gap-1 border-l border-[var(--color-border-subtle)]">
        {listed.map((heading) => (
          <li key={heading.id} className="-ml-px">
            {/* Composed as a template literal, not `cn()`: twMerge cannot tell
                `border-l` (a width) from `border-[var(--color-accent)]` (a
                colour) with certainty, and dropping either would cost the
                marker. Nothing merges a host class in here anyway. */}
            <a
              href={`#${heading.id}`}
              className={`block border-l py-0.5 text-sm transition-colors ${
                heading.depth === 3 ? "pl-6" : "pl-3"
              } ${
                activeId === heading.id
                  ? "border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium"
                  : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]"
              }`}
              onClick={(e) => {
                e.preventDefault()
                document
                  .getElementById(heading.id)
                  ?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
