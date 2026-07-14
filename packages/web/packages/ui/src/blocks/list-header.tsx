"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "../lib/utils"
import { Input } from "../components/input"
import { ButtonBar } from "./button-bar"

export interface ListHeaderSearch {
  /** Controlled filter text. */
  value: string
  /** Called with the new text on every keystroke. */
  onChange: (value: string) => void
  /** Accessible label for the field. Default `"Filter"`. */
  label?: string
  /** Placeholder shown when empty. Default `"Filter…"`. */
  placeholder?: string
  /** Focus the field when its `<input>` attaches. Unlike the native attribute
   *  this re-fires every time the header (re)mounts — e.g. a topic level that
   *  unmounts on exit and remounts on return — while a mere re-render (a
   *  keystroke republishing the level) never steals focus, because the ref
   *  identity is stable. */
  autoFocus?: boolean
  /** Let the field take ALL remaining row width instead of capping at `max-w-xs`
   *  — for headers where the filter is the only occupant (actions live elsewhere,
   *  e.g. the topic level's title row). */
  grow?: boolean
}

export interface ListHeaderProps {
  /** Left-aligned name of the list (e.g. `"Sites"`). */
  title?: React.ReactNode
  /** The filter text field. Omit for an action-only header. */
  search?: ListHeaderSearch
  /** Right-aligned actions (e.g. a `+ New` button, Delete). */
  actions?: React.ReactNode
  ariaLabel: string
  className?: string
}

/**
 * The shared header above a list: title · filter field · [flex] · actions, in
 * the same recessed {@link ButtonBar} strip every toolbar uses. The one home
 * for the "header above a list" pattern — {@link ListWithDetailsPane} renders
 * it above its table, and a HierarchicalTopicDetail level hosts it via the
 * level's `headerSlot` so entity lists inside the stack get the same header.
 */
export function ListHeader({
  title,
  search,
  actions,
  ariaLabel,
  className,
}: ListHeaderProps): React.ReactElement {
  const focusOnAttach = React.useCallback((el: HTMLInputElement | null) => {
    el?.focus()
  }, [])
  return (
    <ButtonBar ariaLabel={ariaLabel} className={className}>
      {title != null && (
        <div className="shrink-0 font-mono text-xs tracking-wide text-apt-text-muted">{title}</div>
      )}
      {search && (
        <div className={cn("relative min-w-0 flex-1", !search.grow && "max-w-xs")}>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-apt-text-muted"
          />
          <Input
            ref={search.autoFocus ? focusOnAttach : undefined}
            type="search"
            value={search.value}
            aria-label={search.label ?? "Filter"}
            placeholder={search.placeholder ?? "Filter…"}
            className="pl-8"
            onChange={(e) => search.onChange(e.target.value)}
          />
        </div>
      )}
      <div className="flex-1" />
      {actions}
    </ButtonBar>
  )
}
