"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"

import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import { Input, fieldShellClass } from "./input"
import { Button } from "./button"
import { cn } from "../lib/utils"

export interface OptionMenuItem {
  value: string
  label: string
}

export interface OptionMenuProps {
  items: OptionMenuItem[]
  /** Committed value: an item's value, OR (when allowOther) free text matching
   *  no item, OR null for nothing selected. */
  value: string | null
  onChange: (value: string, meta: { isOther: boolean }) => void
  allowOther?: boolean
  otherLabel?: string
  otherPlaceholder?: string
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
}

const OTHER = "__other__"

export function OptionMenu({
  items,
  value,
  onChange,
  allowOther = false,
  otherLabel = "Other",
  otherPlaceholder,
  placeholder = "Select…",
  ariaLabel,
  disabled = false,
  className,
}: OptionMenuProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [selection, setSelection] = React.useState<string | null>(null)
  const [otherText, setOtherText] = React.useState("")
  const [otherActive, setOtherActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const baseId = React.useId()

  function optionId(val: string): string {
    return `${baseId}-opt-${val.replace(/[^a-z0-9]/gi, "_")}`
  }
  const activeDescendant =
    open && selection != null ? optionId(selection) : undefined

  const committedItem = items.find((i) => i.value === value) ?? null
  const isCommittedOther = allowOther && value != null && committedItem == null
  const triggerLabel = committedItem
    ? committedItem.label
    : isCommittedOther
      ? value
      : placeholder
  const isPlaceholder = committedItem == null && !isCommittedOther

  const navList = React.useMemo<string[]>(
    () => [...items.map((i) => i.value), ...(allowOther ? [OTHER] : [])],
    [items, allowOther],
  )

  function handleOpenChange(next: boolean): void {
    if (disabled) return
    setOpen(next)
    if (!next) return
    if (committedItem) {
      setSelection(committedItem.value)
      setOtherText("")
      setOtherActive(false)
    } else if (isCommittedOther) {
      setSelection(OTHER)
      setOtherText(value ?? "")
      setOtherActive(true)
    } else {
      // B-2: initialize to first item (NOT Other), even when allowOther is true.
      setSelection(items[0]?.value ?? (allowOther ? OTHER : null))
      setOtherText("")
      setOtherActive(false)
    }
    if (allowOther) requestAnimationFrame(() => inputRef.current?.focus())
  }

  function commit(sel: string | null): void {
    if (sel == null) return
    if (sel === OTHER) {
      const text = otherText.trim()
      if (!text) return
      onChange(text, { isOther: true })
    } else {
      onChange(sel, { isOther: false })
    }
    setOpen(false)
  }

  function move(delta: number): void {
    setSelection((cur) => {
      const idx = cur == null ? 0 : Math.max(0, navList.indexOf(cur))
      const nextIdx = Math.min(navList.length - 1, Math.max(0, idx + delta))
      const next = navList[nextIdx] ?? cur
      if (next === OTHER) {
        requestAnimationFrame(() => inputRef.current?.focus())
      } else {
        inputRef.current?.blur()
        // B-6: ensure the surface retains focus so its keydown handler keeps firing.
        requestAnimationFrame(() => surfaceRef.current?.focus())
      }
      return next
    })
  }

  /** B-1: ArrowDown (and Enter/Space for completeness) on the CLOSED trigger opens the menu. */
  function onTriggerKeyDown(e: React.KeyboardEvent): void {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      handleOpenChange(true)
    }
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      move(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      move(-1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      commit(selection)
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
        onKeyDown={onTriggerKeyDown}
        className={cn(
          fieldShellClass,
          "flex h-9 w-full items-center justify-between gap-2 px-3 text-sm text-apt-text outline-none hover:border-apt-border-strong focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("truncate", isPlaceholder && "text-apt-text-dim")}>{triggerLabel}</span>
        <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-apt-text-muted" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="min-w-56 p-1"
      >
        {/* B-6: focusable surface so keydown handler keeps firing after ArrowUp from Other input */}
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
        <div
          ref={surfaceRef}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeDescendant}
          onKeyDown={onKeyDown}
          tabIndex={-1}
          className="outline-none"
        >
        {items.map((item) => {
          const highlighted = selection === item.value
          const checked = value === item.value && !otherActive
          return (
            <button
              key={item.value}
              id={optionId(item.value)}
              type="button"
              role="option"
              aria-selected={checked}
              data-highlighted={highlighted || undefined}
              onMouseEnter={() => {
                setSelection(item.value)
                setOtherActive(false)
                inputRef.current?.blur()
              }}
              onClick={() => commit(item.value)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-apt-text data-[highlighted]:bg-apt-highlight/15"
            >
              <Check size={14} aria-hidden className={cn("shrink-0", checked ? "text-apt-gold" : "opacity-0")} />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
        {allowOther && (
          <div
            id={optionId(OTHER)}
            role="option"
            aria-selected={otherActive}
            data-highlighted={selection === OTHER || undefined}
            className="rounded-md px-2 py-1.5 data-[highlighted]:bg-apt-highlight/15"
          >
            <div className="flex items-center gap-2 text-sm text-apt-text">
              <Check size={14} aria-hidden className={cn("shrink-0", otherActive ? "text-apt-gold" : "opacity-0")} />
              <span>{otherLabel}</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5 pl-6">
              <Input
                ref={inputRef}
                value={otherText}
                placeholder={otherPlaceholder}
                aria-label={otherLabel}
                onChange={(e) => {
                  setOtherText(e.target.value)
                  setSelection(OTHER)
                  setOtherActive(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    e.stopPropagation()
                    commit(selection)
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    e.stopPropagation()
                    // Spec §4: ArrowUp from the input → jump to the LAST list item above Other,
                    // blur the input, and focus the surface so subsequent arrows keep working.
                    const lastItemValue = items[items.length - 1]?.value ?? null
                    if (lastItemValue != null) {
                      setSelection(lastItemValue)
                      inputRef.current?.blur()
                      requestAnimationFrame(() => surfaceRef.current?.focus())
                    }
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={otherText.trim() === ""}
                onClick={() => commit(OTHER)}
                className="w-full"
              >
                OK
              </Button>
            </div>
          </div>
        )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
