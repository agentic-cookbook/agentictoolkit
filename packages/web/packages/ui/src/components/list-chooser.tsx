"use client"

import * as React from "react"
import { ChevronsUpDown, Check, Plus } from "lucide-react"

import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import { Input, fieldShellClass } from "./input"
import { Button } from "./button"
import { cn } from "../lib/utils"

export interface ListChooserItem {
  value: string
  label: string
}

export interface ListChooserProps {
  items: ListChooserItem[]
  /** Committed value: an item's value, OR (when allowCreate) free text matching
   *  no item, OR null for nothing chosen. */
  value: string | null
  /** Fired on accept. `isNew` is true when the value is typed text, not an item. */
  onChange: (value: string, meta: { isNew: boolean }) => void
  /** Allow accepting typed text that matches no item as a new entry. */
  allowCreate?: boolean
  ariaLabel: string
  /** Accessible label for the filter/add input (defaults to `ariaLabel`). */
  inputLabel?: string
  /** Placeholder shown in the filter/add input. */
  placeholder?: string
  /** Trigger text shown when `value` is null. */
  triggerPlaceholder?: string
  okLabel?: string
  cancelLabel?: string
  /** Builds the "add new" row label from the typed text. */
  createLabel?: (text: string) => string
  /** Shown when no item matches the filter and creation is unavailable. */
  emptyLabel?: string
  /** Keep the popup open after an accept, resetting the field for the next entry —
   *  for a chooser that collects a SET (tags), where closing after every pick makes
   *  adding three tags three round trips through the trigger. Shift+Enter then
   *  dismisses (Escape and Cancel still do too). Default false: a single-value
   *  chooser is done once it has its value, so it closes. */
  keepOpenOnCommit?: boolean
  disabled?: boolean
  className?: string
}

/**
 * `ListChooser` discloses a text-filtered list of items plus a single field that
 * both narrows the list (type to filter, case-insensitive substring) and adds a
 * new entry (text matching no item, when `allowCreate`). Arrow keys move a roving
 * highlight through the filtered list and sync the highlighted label into the
 * field; Enter / OK accept the highlighted item or the typed entry; Esc / Cancel
 * close without committing. An accept closes the popup unless `keepOpenOnCommit`
 * is set, in which case it resets for the next entry and Shift+Enter is what
 * dismisses. Built from the same primitives as `OptionMenu`
 * (`Popover` + `Input` + `Button`) with a hand-managed roving selection.
 */
export function ListChooser({
  items,
  value,
  onChange,
  allowCreate = true,
  ariaLabel,
  inputLabel,
  placeholder = "Filter or add…",
  triggerPlaceholder = "Select…",
  okLabel = "OK",
  cancelLabel = "Cancel",
  createLabel = (text) => `Add “${text}”`,
  emptyLabel = "No matches",
  keepOpenOnCommit = false,
  disabled = false,
  className,
}: ListChooserProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // -1 = nothing highlighted; 0..filtered.length-1 = item; filtered.length = create row.
  const [highlight, setHighlight] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const baseId = React.useId()

  const committedItem = items.find((i) => i.value === value) ?? null
  const isCommittedNew = allowCreate && value != null && committedItem == null
  const triggerLabel = committedItem
    ? committedItem.label
    : isCommittedNew
      ? (value as string)
      : triggerPlaceholder
  const isPlaceholder = committedItem == null && !isCommittedNew

  const q = query.trim().toLowerCase()
  const filtered = React.useMemo(
    () => (q === "" ? items : items.filter((i) => i.label.toLowerCase().includes(q))),
    [items, q],
  )
  const exact = items.find((i) => i.label.toLowerCase() === q) ?? null
  const text = query.trim()
  const canCreate = allowCreate && text !== "" && exact == null
  const navCount = filtered.length + (canCreate ? 1 : 0)
  const onCreateRow = canCreate && highlight === filtered.length
  const highlightedItem =
    highlight >= 0 && highlight < filtered.length ? filtered[highlight] : null

  // The field shows the highlighted item's label when one is highlighted, else
  // whatever the user typed (so arrow-nav previews, typing narrows).
  const displayValue = highlightedItem ? highlightedItem.label : query

  const canAccept =
    highlightedItem != null || (text !== "" && (exact != null || allowCreate))

  const listId = `${baseId}-list`
  const createId = `${baseId}-create`
  const optionId = (i: number): string => `${baseId}-opt-${i}`
  const activeDescendant =
    highlight < 0
      ? undefined
      : highlight < filtered.length
        ? optionId(highlight)
        : onCreateRow
          ? createId
          : undefined

  function handleOpenChange(next: boolean): void {
    if (disabled) return
    setOpen(next)
    if (!next) return
    setQuery("")
    setHighlight(-1)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commit(v: string, isNew: boolean): void {
    onChange(v, { isNew })
    if (!keepOpenOnCommit) {
      setOpen(false)
      return
    }
    // Same state the popup opens in, so the next entry starts from a clean field and an
    // unhighlighted list rather than from the item just taken (which the parent has by now
    // removed from `items`, leaving the highlight pointing at whatever slid into its index).
    setQuery("")
    setHighlight(-1)
    inputRef.current?.focus()
  }

  function accept(): void {
    if (highlightedItem) {
      commit(highlightedItem.value, false)
      return
    }
    if (text === "") return
    if (exact) {
      commit(exact.value, false)
      return
    }
    if (allowCreate) commit(text, true)
  }

  function move(delta: number): void {
    setHighlight((h) => {
      if (navCount === 0) return -1
      if (h < 0) return delta > 0 ? 0 : navCount - 1
      return Math.max(0, Math.min(navCount - 1, h + delta))
    })
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setQuery(e.target.value)
    setHighlight(-1)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      move(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      move(-1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      // In keep-open mode Enter is "add another" and Shift+Enter is "I'm done" — the only
      // way out that doesn't cost a trip to Escape or the mouse. Plain Enter still accepts
      // when the popup closes anyway, so a stray Shift there must not swallow the accept.
      if (keepOpenOnCommit && e.shiftKey) setOpen(false)
      else accept()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          fieldShellClass,
          "flex h-9 w-full items-center justify-between gap-2 px-3 text-sm text-apt-text outline-none hover:border-apt-border-strong focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("truncate", isPlaceholder && "text-apt-text-dim")}>{triggerLabel}</span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-apt-text-muted" />
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-64 p-2">
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            // role=combobox completes the WAI-ARIA combobox pattern: this input
            // owns the listbox (aria-controls) and drives the active option
            // (aria-activedescendant). Without it the aria-* below don't form a
            // valid combobox for assistive tech.
            role="combobox"
            value={displayValue}
            placeholder={placeholder}
            aria-label={inputLabel ?? ariaLabel}
            aria-controls={listId}
            aria-expanded
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            onChange={onInputChange}
            onKeyDown={onInputKeyDown}
          />
          <div
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-1.5 text-sm text-apt-text-muted">{emptyLabel}</p>
            )}
            {filtered.map((item, i) => {
              const highlighted = highlight === i
              const checked = value === item.value && !isCommittedNew
              return (
                <button
                  key={item.value}
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  data-highlighted={highlighted || undefined}
                  onClick={() => commit(item.value, false)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-apt-text hover:bg-apt-highlight/10 data-[highlighted]:bg-apt-highlight/15"
                >
                  <Check
                    size={14}
                    aria-hidden
                    className={cn("shrink-0", checked ? "text-apt-gold" : "opacity-0")}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
            {canCreate && (
              <button
                id={createId}
                type="button"
                role="option"
                aria-selected={false}
                data-highlighted={onCreateRow || undefined}
                onClick={() => commit(text, true)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-apt-text hover:bg-apt-highlight/10 data-[highlighted]:bg-apt-highlight/15"
              >
                <Plus size={14} aria-hidden className="shrink-0 text-apt-text-muted" />
                <span className="truncate">{createLabel(text)}</span>
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-apt-border pt-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={!canAccept}
              onClick={accept}
            >
              {okLabel}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
