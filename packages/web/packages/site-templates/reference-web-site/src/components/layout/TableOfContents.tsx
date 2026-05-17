'use client'

import { useEffect, useState } from 'react'
import type { HeadingEntry } from '../../types'

const HIDDEN_HEADINGS = new Set(['change-history', 'changelog', 'change-log'])

export default function TableOfContents({ headings }: { headings: HeadingEntry[] }) {
  const [activeId, setActiveId] = useState<string>('')
  const filtered = headings.filter((h) => !HIDDEN_HEADINGS.has(h.id))

  useEffect(() => {
    if (filtered.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )
    for (const heading of filtered) {
      const el = document.getElementById(heading.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [headings])

  if (filtered.length === 0) return null

  return (
    <aside className="hidden xl:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4">
      <h4 className="font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-dim)] mb-3">
        On this page
      </h4>
      <ul className="flex flex-col gap-1 border-l border-[var(--color-border-subtle)]">
        {filtered.map((heading) => (
          <li key={heading.id} className="-ml-px">
            <a
              href={`#${heading.id}`}
              className={`block border-l py-0.5 text-sm transition-colors ${
                heading.depth === 3 ? 'pl-6' : 'pl-3'
              } ${
                activeId === heading.id
                  ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                  : 'border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]'
              }`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' })
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
