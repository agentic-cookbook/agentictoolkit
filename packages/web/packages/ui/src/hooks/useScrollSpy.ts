"use client"

import { useEffect, useState } from "react"

/**
 * Track which of a set of element ids is currently the reader's position.
 *
 * The defaults are tuned for a document reader with a sticky header: the top of
 * the viewport is discounted by the header's height, and the bottom 60% is
 * discounted entirely so a heading counts as "current" from the moment it
 * reaches the upper band — not when it happens to be centred.
 *
 * Effects re-subscribe on the ids' VALUE, not the array's identity, so a caller
 * may pass a freshly derived array (`headings.filter(...)`) every render without
 * tearing down and rebuilding the observer each time.
 *
 * `ids` MUST be in document order — that order is what decides which of several
 * simultaneously-visible headings is the reader's position.
 */
export interface UseScrollSpyOptions {
  /** Observer `rootMargin`. Defaults to a sticky-header-aware upper band. */
  rootMargin?: string
  /** Observer `threshold`. Defaults to 0 — any pixel counts as visible. */
  threshold?: number
}

export function useScrollSpy(
  ids: string[],
  options: UseScrollSpyOptions = {},
): string {
  const { rootMargin = "-80px 0px -60% 0px", threshold = 0 } = options
  const [activeId, setActiveId] = useState<string>("")

  // Ids can't contain a newline (they're HTML ids), so joining is a lossless
  // value key for the dependency array.
  const key = ids.join("\n")

  useEffect(() => {
    if (key.length === 0) return

    const order = key.split("\n")

    // A different set of ids is a different document — the reader navigated. The
    // "keep the last known position" rule below is about staying put inside ONE
    // document; carried across a navigation it is someone else's position, and it
    // survives until an observer callback happens to replace it. Usually that looks
    // like nothing (an id from the old page matches no row on the new one), which
    // is exactly why it can sit here: the visible failure needs the two documents
    // to share a heading id — `#overview`, `#usage` — and then the new page opens
    // with its rail already pointing at a heading the reader has not reached.
    setActiveId((previous) => (order.includes(previous) ? previous : ""))

    // Which headings are in the band RIGHT NOW, carried across callbacks.
    // Two reasons it has to be a running set rather than a scan of `entries`:
    // an IntersectionObserver callback reports only what CHANGED (so a heading
    // that is still visible from three scrolls ago is simply absent), and the
    // entries within one callback are in no guaranteed order. Setting the id of
    // each intersecting entry as it arrives would therefore be last-write-wins —
    // it would land on whichever heading the observer happened to mention last.
    const visible = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        // The reader's position is the FIRST visible heading in document order:
        // with several in the band they are reading under the topmost one.
        const current = order.find((id) => visible.has(id))
        // Nothing in the band (scrolled into a long section, or past the end)
        // keeps the last known position rather than clearing the rail.
        if (current) setActiveId(current)
      },
      { rootMargin, threshold },
    )

    for (const id of order) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [key, rootMargin, threshold])

  return activeId
}
