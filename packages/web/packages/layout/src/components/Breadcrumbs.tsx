'use client'

import { useLink } from '@agentic-toolkit/model'
import type { BreadcrumbEntry } from '@agentic-toolkit/model'

export type BreadcrumbsProps = {
  trail: BreadcrumbEntry[]
  separator?: string
}

export function Breadcrumbs({ trail, separator = '/' }: BreadcrumbsProps) {
  const Link = useLink()
  return (
    <nav className="awt-breadcrumbs" aria-label="Breadcrumb">
      {trail.map((entry, i) => {
        const isLast = i === trail.length - 1
        return (
          <span
            key={entry.path}
            className={`awt-breadcrumbs__item${isLast ? ' awt-breadcrumbs__item--current' : ''}`}
          >
            {isLast ? <span>{entry.label}</span> : <Link to={entry.path}>{entry.label}</Link>}
            {!isLast && <span className="awt-breadcrumbs__separator">{separator}</span>}
          </span>
        )
      })}
    </nav>
  )
}
