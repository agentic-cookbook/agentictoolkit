"use client"

import type { ReactElement } from "react"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "../components/dropdown-menu"

// Faithful port of the adh.com/home resource selector —
// hub/src/components/home/resource/ResourcePopup.tsx (+ .ecosystem-popup__*
// in settings.css) — decoupled from routing: selection is a callback, where the
// hub deep-links. Built from the shared dropdown-menu.

export interface PopupMenuItem {
  id: string
  label: string
}

/**
 * The focused-item selector at the top of a rail: a dropdown of "All" + each
 * item, a divider, then an optional "New …" entry. `selectedId: null` means
 * nothing is focused (the "All" state). Pass `allLabel={null}` for a plain
 * switcher with no "All" state (one item is always selected) — the "All" row is
 * then omitted entirely.
 */
export function PopupMenu({
  items,
  selectedId,
  onSelect,
  allLabel = "All",
  onNew,
  newLabel = "New…",
  ariaLabel,
}: {
  items: PopupMenuItem[]
  /** The focused item id, or null for "All" (nothing focused). */
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** The "All" entry label, or `null` to omit the "All" row (a plain switcher). */
  allLabel?: string | null
  onNew?: () => void
  newLabel?: string
  ariaLabel: string
}): ReactElement {
  const ALL = "__all__"
  // Fail fast on a sentinel collision — an item id of "__all__" would be
  // indistinguishable from the "All" entry and select as null.
  if (items.some((i) => i.id === ALL)) {
    console.warn(`PopupMenu: item id "${ALL}" collides with the All sentinel`)
  }
  const value = selectedId ?? ALL
  const active = items.find((i) => i.id === selectedId)
  const label = active ? active.label : (allLabel ?? "")

  return (
    <div className="flex flex-col">
      <DropdownMenu>
        {/* .ecosystem-popup__trigger */}
        <DropdownMenuTrigger
          aria-label={ariaLabel}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-apt-border bg-apt-surface px-[0.6rem] py-[0.4rem] text-[0.8rem] text-apt-text hover:border-apt-border-strong focus-visible:border-apt-gold focus-visible:outline-none"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown size={13} aria-hidden className="shrink-0 text-apt-text-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[12rem] border border-apt-border bg-apt-surface-2 text-apt-text"
        >
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(v: string) => onSelect(v === ALL ? null : v)}
          >
            {allLabel !== null && (
              <DropdownMenuRadioItem value={ALL} accent>
                {allLabel}
              </DropdownMenuRadioItem>
            )}
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.id} value={item.id} accent>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {onNew && (
            <>
              <DropdownMenuSeparator className="bg-apt-border" />
              <DropdownMenuItem onClick={onNew} accent>
                <Plus size={14} aria-hidden />
                {newLabel}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
