'use client'

import { useEffect, useState } from 'react'
import type { HeadingEntry } from '@agentic-web-toolkit/model'

export type TableOfContentsProps = {
  headings: HeadingEntry[]
  title?: string
  minDepth?: number
  maxDepth?: number
}

export function TableOfContents({
  headings,
  title = 'On this page',
  minDepth = 2,
  maxDepth = 4,
}: TableOfContentsProps) {
  const visible = headings.filter((h) => h.depth >= minDepth && h.depth <= maxDepth)
  const [activeId, setActiveId] = useState<string | null>(visible[0]?.id ?? null)

  useEffect(() => {
    if (visible.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    for (const h of visible) {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [visible])

  if (visible.length === 0) return null

  return (
    <nav className="awt-toc" aria-label="Table of contents">
      <div className="awt-toc__title">{title}</div>
      <ul className="awt-toc__list">
        {visible.map((h) => (
          <li
            key={h.id}
            className={`awt-toc__item awt-toc__item--depth-${h.depth}${
              h.id === activeId ? ' awt-toc__item--active' : ''
            }`}
          >
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
