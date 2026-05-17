'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useFilteredList } from './useFilteredList'
import type { FilteredListProps } from './types'

export function FilteredList<T>(props: FilteredListProps<T>) {
  const {
    placeholder = 'Filter…',
    className,
    autoFocus = false,
    renderItem,
    onSelect,
    onHighlightChange,
    footer,
    emptyContent,
    getId,
    getTitle,
    getSubtitle,
    getDetails,
    ...config
  } = props

  const { query, setQuery, visible, total, empty } = useFilteredList({
    ...config,
    getId,
    getTitle,
    getSubtitle,
    getDetails,
  })

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listId = useId()
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])
  const onHighlightChangeRef = useRef(onHighlightChange)
  const lastHighlightedRef = useRef<T | null>(null)

  const filtering = query.trim() !== ''
  const rootClass = className ? `fl-root ${className}` : 'fl-root'

  // Whenever the visible set shrinks, keep the highlight valid.
  useEffect(() => {
    if (highlightedIndex >= visible.length) {
      setHighlightedIndex(visible.length === 0 ? -1 : visible.length - 1)
    }
  }, [visible.length, highlightedIndex])

  // Consumers commonly pass an inline onHighlightChange; depending on it would
  // re-fire this effect every parent render. Track the resolved item by
  // reference and only notify when it actually changes.
  useEffect(() => {
    onHighlightChangeRef.current = onHighlightChange
  })
  useEffect(() => {
    const item = highlightedIndex >= 0 ? (visible[highlightedIndex] ?? null) : null
    if (item !== lastHighlightedRef.current) {
      lastHighlightedRef.current = item
      onHighlightChangeRef.current?.(item)
    }
  })

  // Scroll the active item into view when highlight moves.
  useLayoutEffect(() => {
    if (highlightedIndex < 0) return
    const el = itemRefs.current[highlightedIndex]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const highlighted = highlightedIndex >= 0 ? visible[highlightedIndex] : undefined
  const inputValue = highlighted !== undefined ? (getTitle(highlighted) ?? '') : query

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (visible.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i < 0 ? 0 : Math.min(i + 1, visible.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => (i <= 0 ? -1 : i - 1))
    } else if (e.key === 'Enter') {
      if (highlighted !== undefined) {
        e.preventDefault()
        onSelect?.(highlighted)
      }
    } else if (e.key === 'Escape') {
      if (highlightedIndex >= 0) {
        e.preventDefault()
        setHighlightedIndex(-1)
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHighlightedIndex(-1)
    setQuery(e.target.value)
  }

  return (
    <div className={rootClass}>
      <input
        type="text"
        className="fl-input"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={visible.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          highlighted !== undefined ? `${listId}-${getId(highlighted)}` : undefined
        }
        autoComplete="off"
      />
      {total === 0 ? (
        <div className="fl-empty">No items.</div>
      ) : (
        <ul className="fl-list" id={listId} role="listbox">
          {visible.map((item, i) => {
            const id = getId(item)
            const active = i === highlightedIndex
            const body = renderItem ? (
              renderItem(item)
            ) : (
              <>
                <div className="fl-title">{getTitle(item) ?? ''}</div>
                {getSubtitle?.(item) && <div className="fl-subtitle">{getSubtitle(item)}</div>}
                {getDetails?.(item) && <div className="fl-details">{getDetails(item)}</div>}
              </>
            )
            const itemClass = `fl-item${onSelect ? ' fl-item--clickable' : ''}${active ? ' fl-item--active' : ''}`
            const liProps = {
              id: `${listId}-${id}`,
              role: 'option',
              'aria-selected': active,
              className: itemClass,
              ref: (el: HTMLLIElement | null) => {
                itemRefs.current[i] = el
              },
              onMouseEnter: () => setHighlightedIndex(i),
            }
            if (onSelect) {
              return (
                <li key={id} {...liProps}>
                  <button
                    type="button"
                    className="fl-item-button"
                    onClick={() => onSelect(item)}
                    tabIndex={-1}
                  >
                    {body}
                  </button>
                </li>
              )
            }
            return <li key={id} {...liProps}>{body}</li>
          })}
          {empty && filtering && (
            <li className="fl-empty">
              {emptyContent ?? <>No matches for &ldquo;{query}&rdquo;.</>}
            </li>
          )}
          {footer && <li className="fl-footer">{footer}</li>}
        </ul>
      )}
    </div>
  )
}
