'use client'

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../../contexts/ContentContext'
import { useSiteConfig } from '../../contexts/SiteConfigContext'
import { search } from '../../lib/search'
import type { SiteEntry } from '../../types'

interface SearchDialogProps {
  open: boolean
  onClose: () => void
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SiteEntry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { entries } = useContent()
  const config = useSiteConfig()
  const navigate = useNavigate()

  const sectionLabels: Record<string, string> = {}
  for (const s of config.nav.sections) sectionLabels[s.key] = s.label

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  function handleQueryChange(value: string) {
    setQuery(value)
    setSelectedIndex(0)
    setResults(search(value, entries))
  }

  function handleSelect(entry: SiteEntry) {
    navigate(entry.slug)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const grouped = new Map<string, SiteEntry[]>()
  for (const entry of results.slice(0, 20)) {
    const section = entry.section || 'other'
    if (!grouped.has(section)) grouped.set(section, [])
    grouped.get(section)!.push(entry)
  }

  if (!open) return null

  let flatIndex = 0

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-4 top-20 mx-auto max-w-xl">
        <div className="rounded-xl bg-[var(--color-surface-raised)] shadow-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border-subtle)]">
            <svg
              className="h-5 w-5 text-[var(--color-text-dim)] shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search documentation..."
              className="flex-1 py-3 text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-dim)]"
            />
            <kbd className="font-mono text-[10px] text-[var(--color-text-dim)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
              Esc
            </kbd>
          </div>
          {query && (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--color-text-dim)]">
                  No results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                Array.from(grouped.entries()).map(([section, sectionEntries]) => (
                  <div key={section}>
                    <div className="px-4 py-1 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-dim)]">
                      {sectionLabels[section] ?? section}
                    </div>
                    {sectionEntries.map((entry) => {
                      const idx = flatIndex++
                      return (
                        <button
                          key={entry.slug}
                          onClick={() => handleSelect(entry)}
                          className={`w-full text-left px-4 py-2 flex items-center gap-2 ${
                            idx === selectedIndex
                              ? 'bg-[var(--color-accent-dim)]'
                              : 'hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {entry.frontmatter.title}
                            </div>
                            {entry.frontmatter.summary && (
                              <div className="text-xs text-[var(--color-text-dim)] truncate">
                                {entry.frontmatter.summary}
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
