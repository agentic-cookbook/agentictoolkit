'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { noAutofillProps } from '@agenticdevelopertoolkit/ui/lib/autofill'
import { cn } from '@agenticdevelopertoolkit/ui/lib/utils'
import { railLinkVariants } from '@agenticdevelopertoolkit/ui/lib/nav-rail'

export interface RailTopic {
  id: string
  label: string
  href: string
  active: boolean
  leaf: boolean
}

/** The details-page topic rail: a substring title filter on top, then the topic
 *  links. Arrow keys move focus through the (filtered) list; Enter follows the
 *  focused link natively (the links stay real <a>s, so the rail is crawlable and
 *  works with JS off). A client island — its own chunk via a dedicated package
 *  subpath, the same boundary trick as graph/ConceptGraphClient. */
export function DetailsRail({ topics, siteLabel }: { topics: RailTopic[]; siteLabel: string }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([])

  const q = query.trim().toLowerCase()
  const filtered = q ? topics.filter((t) => t.label.toLowerCase().includes(q)) : topics

  const focusItem = (i: number) => {
    const n = filtered.length
    if (n === 0) return
    linkRefs.current[Math.max(0, Math.min(n - 1, i))]?.focus()
  }

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(0)
    }
  }
  const onItemKey = (e: KeyboardEvent<HTMLAnchorElement>, i: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(i + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (i === 0) inputRef.current?.focus()
      else focusItem(i - 1)
    }
    // Enter activates the focused <a> natively.
  }

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className="adh-details__rail-filter"
        placeholder="Filter topics…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onInputKey}
        aria-label={`Filter ${siteLabel} topics`}
        aria-controls="adh-details-rail-nav"
        {...noAutofillProps}
      />
      <nav
        id="adh-details-rail-nav"
        className="adh-details__rail-nav"
        aria-label={`${siteLabel} topics`}
      >
        {filtered.map((t, i) => (
          <a
            key={t.id}
            ref={(el) => {
              linkRefs.current[i] = el
            }}
            href={t.href}
            // Shared nav-rail grammar (the one home; @agenticdevelopertoolkit/ui/lib/nav-rail).
            // Still a real <a> — crawlable, keyboard-navigable, works with JS off.
            className={cn(railLinkVariants({ active: t.active, leaf: t.leaf }))}
            aria-current={t.active ? 'page' : undefined}
            onKeyDown={(e) => onItemKey(e, i)}
          >
            {t.label}
          </a>
        ))}
        {filtered.length === 0 && (
          <p className="adh-details__rail-empty">No matching topics</p>
        )}
      </nav>
    </>
  )
}
