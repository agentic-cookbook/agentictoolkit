"use client"

import * as React from "react"
import { Autocomplete } from "@base-ui/react/autocomplete"
import { Check } from "lucide-react"

import { cn } from "../lib/utils"
import { fieldShellClass } from "./input"

export interface ComboboxProps {
  /** Suggestions filtered (case-insensitive substring) as the user types. */
  items: readonly string[]
  /** Controlled input text. */
  value: string
  onValueChange: (value: string) => void
  ariaLabel: string
  placeholder?: string
  /** Shown inside the popup when nothing matches the current text. */
  emptyLabel?: string
  disabled?: boolean
  /** Extra classes for the input. */
  className?: string
  /** Optional id for the input (e.g. to pair with an external <label htmlFor>). */
  id?: string
}

/**
 * `Combobox` is a free-text input that reveals a popup of matching suggestions as
 * the user types — keyboard-selectable (Up/Down to move, Enter to pick, Esc to
 * close). It replaces the native `<datalist>` pattern, wrapping Base UI's headless
 * `Autocomplete` so it carries the correct combobox ARIA (`role="combobox"`,
 * `aria-expanded`, `aria-controls`, `aria-activedescendant`) for free, themed with
 * `apt-*` tokens.
 */
export function Combobox({
  items,
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  emptyLabel = "No matches",
  disabled = false,
  className,
  id,
}: ComboboxProps): React.ReactElement {
  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      disabled={disabled}
    >
      <Autocomplete.Input
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={cn(
          fieldShellClass,
          "flex h-9 w-full min-w-0 px-3 py-2 text-sm text-apt-text outline-none transition-colors",
          "placeholder:text-apt-text-dim selection:bg-apt-gold/30",
          "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      <Autocomplete.Portal>
        <Autocomplete.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Autocomplete.Popup
            className={cn(
              "z-50 w-(--anchor-width) max-h-[min(20rem,var(--available-height))] overflow-y-auto",
              "rounded-lg border border-apt-border bg-apt-surface p-1 text-sm text-apt-text shadow-lg outline-none",
            )}
          >
            <Autocomplete.Empty className="px-2 py-1.5 text-sm text-apt-text-muted">
              {emptyLabel}
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item
                  key={item}
                  value={item}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-apt-text outline-none",
                    "data-[highlighted]:bg-apt-highlight/15",
                  )}
                >
                  <Check
                    size={14}
                    aria-hidden
                    className={cn("shrink-0", item === value ? "text-apt-gold" : "opacity-0")}
                  />
                  <span className="truncate">{item}</span>
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}
