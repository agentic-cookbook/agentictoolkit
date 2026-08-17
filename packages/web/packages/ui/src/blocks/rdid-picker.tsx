"use client"

import * as React from "react"

import { CommandPalette, type CommandGroup } from "./command-palette"

/**
 * PICK AN RDID: search the identifier registry in a modal and hand one address back.
 *
 * Built on {@link CommandPalette} rather than beside it, because the palette already IS this
 * interaction — a modal over one field, keyboard-driven, first result preselected, Enter runs it
 * and closes. A second dialog with a search box and a list of results would be that component
 * with a different name and its own opinions about arrow keys.
 *
 * SCOPING IS THE CALLER'S, and that is the design. The brief asks for a picker that can be
 * limited to ecosystems "or whatever"; a `scope` prop here would mean this component owns the
 * list of scopes, and every new entity type would have to come back and edit it. Instead the
 * caller closes over its own filter when it builds `search`, so restricting the picker to
 * ecosystems is `search={(q, s) => searchRdids({ q, entityType: 'ecosystem', signal: s })}` and
 * the picker never learns what an ecosystem is. `entityTypeLabel` exists only to say so in the
 * placeholder.
 *
 * DEBOUNCING LIVES HERE, not in the palette. The palette is a controlled input with no position
 * on when the host fetches — right, for a host mixing local commands with remote hits. But this
 * picker's list IS the fetch, so the trailing delay and the abort of a superseded request belong
 * to it.
 */
export interface RdidOption {
  rdid: string
  entityType: string
  entityId: string
}

export interface RdidPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the WHOLE option — a caller that needs the entity id must not have to re-resolve
   *  the address it just picked, which is a second lookup that can disagree with the first. */
  onPick: (option: RdidOption) => void
  /** Runs on a trailing delay. The signal aborts when a newer keystroke supersedes this call. */
  search: (query: string, signal: AbortSignal) => Promise<RdidOption[]>
  /** Named in the placeholder, e.g. `"ecosystem"` → "Search ecosystem addresses…". */
  entityTypeLabel?: string
  title?: string
  placeholder?: string
  /** Default 200. */
  debounceMs?: number
}

export function RdidPicker({
  open,
  onOpenChange,
  onPick,
  search,
  entityTypeLabel,
  title = "Choose an address",
  placeholder,
  debounceMs = 200,
}: RdidPickerProps): React.ReactElement {
  const [query, setQuery] = React.useState("")
  const [options, setOptions] = React.useState<RdidOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // `search` is usually an inline arrow, so a new identity every render. Reading it from a ref
  // keeps the effect below keyed on the QUERY — otherwise every parent re-render restarts the
  // debounce and a steadily-typing user never reaches the trailing edge.
  const searchRef = React.useRef(search)
  React.useEffect(() => {
    searchRef.current = search
  })

  // A closed picker forgets what was typed in it: reopening onto a stale query and a stale list
  // offers the user a result for a search they have moved on from.
  React.useEffect(() => {
    if (open) return
    setQuery("")
    setOptions([])
    setError(null)
    setLoading(false)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q === "") {
      setOptions([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchRef.current(q, controller.signal).then(
        (next) => {
          if (controller.signal.aborted) return
          setOptions(next)
          setError(null)
          setLoading(false)
        },
        (e: unknown) => {
          if (controller.signal.aborted) return
          // Say what went wrong. An empty list after a failed request reads as "no such address",
          // which is the one wrong conclusion available here.
          setError(e instanceof Error ? e.message : "Search failed")
          setOptions([])
          setLoading(false)
        },
      )
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, debounceMs])

  const groups: CommandGroup[] = [
    {
      id: "rdids",
      label: entityTypeLabel ? `${entityTypeLabel} addresses` : "Addresses",
      items: options.map((option) => ({
        id: option.rdid,
        label: option.rdid,
        badge: option.entityType,
        onSelect: () => onPick(option),
      })),
    },
  ]

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      ariaLabel={title}
      placeholder={
        placeholder ??
        (entityTypeLabel ? `Search ${entityTypeLabel} addresses…` : "Search addresses…")
      }
      loading={loading}
      error={error}
      emptyLabel={query.trim() === "" ? "Start typing an address" : "No matching address"}
    />
  )
}
