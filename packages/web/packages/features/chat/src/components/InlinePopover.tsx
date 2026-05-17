'use client'

import { useState } from 'react'
import type { PopoverData } from '../types'

interface InlinePopoverProps {
  data: PopoverData
  defaultOpen?: boolean
}

export function InlinePopover({ data, defaultOpen = true }: InlinePopoverProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={`pc-popover ${open ? 'pc-popover-open' : ''}`}
      aria-hidden={!open}
    >
      <button
        className="pc-popover-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle details"
      >
        <span className="pc-popover-arrow" />
        {data.title && <span className="pc-popover-title">{data.title}</span>}
      </button>
      <div className="pc-popover-body">
        {data.description && (
          <div className="pc-popover-desc">{data.description}</div>
        )}
        {data.links && data.links.length > 0 && (
          <div className="pc-popover-links">
            {data.links.map((link, i) => (
              <a
                key={i}
                className="pc-popover-link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label || link.url}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
