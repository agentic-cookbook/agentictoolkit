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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin, threshold },
    )

    for (const id of key.split("\n")) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [key, rootMargin, threshold])

  return activeId
}
