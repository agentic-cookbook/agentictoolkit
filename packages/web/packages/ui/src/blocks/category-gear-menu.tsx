"use client"

import * as React from "react"
import { Settings } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../components/dropdown-menu"
import { cn } from "../lib/utils"

/** The five verbs. `add` acts on the LIST; the other four act on its selected row. */
export type CategoryGearAction = "add" | "rename" | "move" | "file" | "delete"

export interface CategoryGearMenuProps {
  /** The selected row's name, or `null` when nothing editable is selected. It is what the
   *  three target verbs are labelled with, so the user reads what they are about to act on
   *  instead of inferring it from the rail. */
  targetName: string | null
  /** Whether the three target verbs are available. FALSE for no selection and for the
   *  synthetic rows (All, Uncategorized), which name no category to act on. */
  canEditTarget: boolean
  /** Singular, lowercase. Defaults to "category". */
  noun?: string
  onAction: (action: CategoryGearAction) => void
  disabled?: boolean
  className?: string
}

/** `Rename “Q3”…` when there is a target, `Rename…` when there is not. Naming the target in
 *  the item is what makes a menu opened from a header unambiguous — the header is not the
 *  selection, and a bare "Rename…" would leave the user guessing which.
 *
 *  `tail` is for the one verb whose object is not the last word: filing reads "Also file
 *  “Q3” in…", because the ellipsis stands for the PLACE being asked for, and dropping the
 *  preposition would make it read like another word for Move. */
function labelFor(verb: string, targetName: string | null, tail = ""): string {
  const suffix = tail === "" ? "" : ` ${tail}`
  return targetName === null
    ? `${verb}${suffix}…`
    : `${verb} “${targetName}”${suffix}…`
}

/**
 * The gear in a category list's header: Add, Rename, Move, Delete.
 *
 * It is deliberately DUMB — it renders four items and reports which was chosen. Every
 * dialog, every write and every disabled rule that depends on the data lives in the host,
 * because this block sits in `ui` and `ui` does not reach the API. The host is also where
 * the target comes from, and that matters more than it looks: HTDV's level cache
 * (`rail-host.tsx`'s `levelsKey`) deliberately ignores ReactNode props, so a gear that
 * closed over its target at register time would keep acting on a stale one after a rename.
 * Hosts pass the target as a plain prop from state re-read each render, or from context.
 *
 * Add is enabled whether or not a row is selected: it creates a child of the LIST's own
 * category (a new root, in the root list), which is a question the selection cannot answer.
 *
 * MOVE AND FILE ARE DIFFERENT VERBS, and the menu has to make that legible or the DAG is not
 * usable from here. Move rewrites the filing the user walked in through — one place becomes
 * another. File ADDS a place and touches nothing else, which is the only way to express what
 * the data model has always allowed: a category that genuinely lives in two branches. Before
 * File existed, the sole route to a second filing was a dialog in the notebook feature that
 * the research rail cannot reach, so the hierarchy read as a tree to anyone standing here.
 */
export function CategoryGearMenu({
  targetName,
  canEditTarget,
  noun = "category",
  onAction,
  disabled = false,
  className,
}: CategoryGearMenuProps): React.ReactElement {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${Noun} actions`}
        disabled={disabled}
        className={cn(
          "flex size-6 items-center justify-center rounded text-apt-text-dim outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40 disabled:opacity-40",
          className,
        )}
      >
        <Settings size={14} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onAction("add")}>Add {noun}…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canEditTarget} onClick={() => onAction("rename")}>
          {labelFor("Rename", canEditTarget ? targetName : null)}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canEditTarget} onClick={() => onAction("move")}>
          {labelFor("Move", canEditTarget ? targetName : null)}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canEditTarget} onClick={() => onAction("file")}>
          {labelFor("Also file", canEditTarget ? targetName : null, "in")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canEditTarget}
          className="text-apt-red"
          onClick={() => onAction("delete")}
        >
          {labelFor("Delete", canEditTarget ? targetName : null)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
