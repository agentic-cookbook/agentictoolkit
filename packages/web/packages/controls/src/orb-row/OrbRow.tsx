'use client'

import type { ReactElement } from 'react'
import type { OrbRowProps } from './types'

export function OrbRow({ sites, currentSite, docked, className }: OrbRowProps): ReactElement {
  const classes = [
    'orb-row',
    docked ? 'is-docked' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} role="navigation" aria-label="Agentic family">
      {sites.map((s) => {
        const isCurrent = s.id === currentSite
        return (
          <a
            key={s.id}
            href={s.url}
            className={`orb-row-orb${isCurrent ? ' is-current' : ''}`}
            style={{ background: s.iconGradient }}
            aria-label={s.name}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <span className="orb-row-emoji" aria-hidden="true">
              {s.emoji}
            </span>
            <span className="orb-row-tooltip" role="tooltip">
              {s.name}
            </span>
            {isCurrent ? <span className="orb-row-here" aria-hidden="true" /> : null}
          </a>
        )
      })}
    </div>
  )
}
