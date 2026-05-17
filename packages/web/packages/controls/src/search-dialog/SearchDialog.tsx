'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { SearchState } from '@agentic-web-toolkit/model'
import type { SiteEntry } from '@agentic-web-toolkit/model'

export type SearchDialogProps = {
  open: boolean
  onClose: () => void
  state: SearchState
  onSelect: (entry: SiteEntry) => void
  sectionLabels?: Record<string, string>
  placeholder?: string
}

export function SearchDialog({
  open,
  onClose,
  state,
  onSelect,
  sectionLabels = {},
  placeholder = 'Search documentation...',
}: SearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      state.reset()
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    // intentionally only react to `open` toggling — resetting on every state change would clobber typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const top = state.results.slice(0, 20)
  const grouped = new Map<string, SiteEntry[]>()
  for (const r of top) {
    const section = r.entry.section || 'other'
    if (!grouped.has(section)) grouped.set(section, [])
    grouped.get(section)!.push(r.entry)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const sel = top[state.selectedIndex]
      if (sel) onSelect(sel.entry)
      return
    }
    if (e.key === 'Escape') {
      onClose()
      return
    }
    state.handleKey(e)
  }

  let flatIndex = 0

  return (
    <div className="awt-search-dialog" role="dialog" aria-modal="true">
      <div className="awt-search-dialog__backdrop" onClick={onClose} />
      <div className="awt-search-dialog__panel-wrap">
        <div className="awt-search-dialog__panel">
          <div className="awt-search-dialog__input-row">
            <svg
              className="awt-search-dialog__icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="awt-search-dialog__input"
              value={state.query}
              onChange={(e) => state.setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder={placeholder}
              aria-label="Search"
            />
            <kbd className="awt-search-dialog__kbd">Esc</kbd>
          </div>
          {state.query && (
            <div className="awt-search-dialog__results">
              {top.length === 0 ? (
                <p className="awt-search-dialog__empty">No results for &ldquo;{state.query}&rdquo;</p>
              ) : (
                Array.from(grouped.entries()).map(([section, sectionEntries]) => (
                  <div key={section}>
                    <div className="awt-search-dialog__section-label">
                      {sectionLabels[section] ?? section}
                    </div>
                    {sectionEntries.map((entry) => {
                      const idx = flatIndex++
                      const isSelected = idx === state.selectedIndex
                      return (
                        <button
                          key={entry.slug}
                          type="button"
                          onClick={() => onSelect(entry)}
                          className={`awt-search-dialog__result${
                            isSelected ? ' awt-search-dialog__result--selected' : ''
                          }`}
                        >
                          <div className="awt-search-dialog__result-body">
                            <div className="awt-search-dialog__result-title">
                              {entry.frontmatter.title}
                            </div>
                            {entry.frontmatter.summary && (
                              <div className="awt-search-dialog__result-summary">
                                {String(entry.frontmatter.summary)}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
