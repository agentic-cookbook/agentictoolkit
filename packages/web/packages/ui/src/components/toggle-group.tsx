"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn } from "../lib/utils"
import { fieldShellClass } from "./input"

/**
 * A segmented control — a row of mutually-exclusive option buttons (e.g. a
 * light/dark/system theme switcher). Built on Base UI's ToggleGroup so it stays
 * consistent with the family's other base-ui primitives (radio/switch), themed
 * from `apt-*` tokens (gold fill on the pressed item).
 *
 * Base UI's value is always `string[]`. For a single-select control leave
 * `multiple` at its default (false) and pass `value={[selected]}`; in the
 * `onValueChange` handler take `next[0]` and ignore the empty array (clicking the
 * already-pressed item would otherwise deselect it — a segmented control always
 * keeps one selection).
 */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive>): React.ReactElement {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        fieldShellClass,
        "inline-flex w-fit items-center gap-1 p-1",
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof TogglePrimitive>): React.ReactElement {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap",
        "text-apt-text-muted transition-colors outline-none cursor-pointer select-none",
        "hover:text-apt-text",
        "focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        "data-[pressed]:bg-apt-gold data-[pressed]:text-apt-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
