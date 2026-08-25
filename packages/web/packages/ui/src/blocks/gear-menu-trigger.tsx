"use client"

import * as React from "react"
import { Settings } from "lucide-react"

import { DropdownMenuTrigger } from "../components/dropdown-menu"
import { cn } from "../lib/utils"

export interface GearMenuTriggerProps {
  /** What the menu acts on, as a screen reader reads it: "Registry actions". Required —
   *  a bare gear announces nothing, and a header may hold more than one. */
  label: string
  disabled?: boolean
  className?: string
}

/**
 * The gear that opens a menu of actions on a list, in a rail header or a home bar.
 *
 * It exists as its own component for one reason: it is the fleet's SIGN for "the verbs that
 * act on this list live here", and a sign only works while every instance of it looks the
 * same. `CategoryGearMenu` had the only one, styled inline; the second host would have
 * copied those classes and the two would have drifted apart on the next token change.
 *
 * Deliberately just the trigger — the items are the host's, because what a gear offers is
 * never shared between two lists. Compose it inside a `DropdownMenu` with your own
 * `DropdownMenuContent`.
 */
export function GearMenuTrigger({
  label,
  disabled = false,
  className,
}: GearMenuTriggerProps): React.ReactElement {
  return (
    <DropdownMenuTrigger
      aria-label={label}
      disabled={disabled}
      className={cn(
        "flex size-6 items-center justify-center rounded text-apt-text-dim outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40 disabled:opacity-40",
        className,
      )}
    >
      <Settings size={14} aria-hidden />
    </DropdownMenuTrigger>
  )
}
