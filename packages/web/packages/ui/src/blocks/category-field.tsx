"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { Field } from "./field"
import { Combobox } from "../components/combobox"
import { EntityChooser } from "../components/entity-chooser"
import { Input } from "../components/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/dialog"
import { DialogActions } from "../components/dialog-actions"
import { ErrorText } from "../components/error-text"
import { cn } from "../lib/utils"

/** One category in the owner's tree. `parentId` is an app-level convention with no FK behind it,
 *  so the walk below tolerates a parent that is missing or cyclic rather than trusting it. */
export interface CategoryTreeNode {
  id: string
  name: string
  parentId: string | null
}

/**
 * Walk from a node to the root, outermost first. Guards a broken tree two ways: a `parentId`
 * naming no node ends the walk, and a cycle is cut by the seen-set — either way the caller gets a
 * trail, never a hang.
 */
export function categoryTrail(
  nodes: readonly CategoryTreeNode[],
  leaf: CategoryTreeNode,
): CategoryTreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const trail: CategoryTreeNode[] = [leaf]
  const seen = new Set<string>([leaf.id])
  let cur = leaf
  while (cur.parentId) {
    const parent = byId.get(cur.parentId)
    if (!parent || seen.has(parent.id)) break
    trail.unshift(parent)
    seen.add(parent.id)
    cur = parent
  }
  return trail
}

/** The node a name refers to. Names are unique per owner across the whole tree, so this is exact;
 *  the case-insensitive fallback is for a name typed back in with different capitalisation. */
function nodeForName(
  nodes: readonly CategoryTreeNode[],
  name: string,
): CategoryTreeNode | null {
  const want = name.trim()
  if (want === "") return null
  return (
    nodes.find((n) => n.name === want) ??
    nodes.find((n) => n.name.toLowerCase() === want.toLowerCase()) ??
    null
  )
}

/**
 * The family's CATEGORY editor: one form row for "this thing is filed in exactly one place in a
 * tree the owner maintains".
 *
 * Same `[Combobox autocomplete] + [Choose… browser]` pair as {@link TagSetField}, for the same
 * reason — the Combobox is for the category you can name, the chooser is for the one you have to
 * go and find, and it is also where a new one is minted. Two things are category-specific:
 *
 *  - **The value is shown as a BREADCRUMB, not a bare name.** The vocabulary is a tree, and
 *    "Design" under "Archive" is a different place from "Design" under "Active"; a flat name
 *    tells the user which name they picked but not where it sits.
 *  - **A crumb is clickable, and renames.** The tree is edited from wherever it is displayed
 *    rather than only from a separate management screen — the rename is the one edit that is
 *    always safe from here, because a rename moves nothing.
 *
 * The picker itself stays FLAT (names, not a tree walk): a name is unique per owner across the
 * whole tree, so a name already names one place in it and typing three characters beats
 * navigating three levels. The breadcrumb is what makes the flat pick legible afterwards.
 *
 * WORDS ARE THE HOST'S. `label` names the row; `noun` (singular, lowercase) builds the controls'
 * microcopy — nothing here hardcodes "category".
 */
export function CategoryField({
  label,
  noun,
  hint,
  options,
  nodes = [],
  value,
  onChange,
  onRename,
  layout,
  disabled = false,
  className,
}: {
  /** The row's caption — the noun as a heading ("Category"). */
  label: string
  /** The singular, lowercase noun for the controls' microcopy ("category"). */
  noun: string
  hint?: React.ReactNode
  /** The names to offer. A SUGGESTION list, never a closed set — `value` may hold a name that is
   *  not in it (one just created, or one another surface added). */
  options: readonly string[]
  /** The tree behind those names, when the host has it. Drives the breadcrumb and the rename;
   *  omit it and the value renders as the single name it is. */
  nodes?: readonly CategoryTreeNode[]
  /** The chosen name, or `""` for none. */
  value: string
  onChange: (next: string) => void
  /** Rename an existing node, from a click on its crumb. May be async — the dialog shows a spinner
   *  until it settles, and stays open (with the error) if it rejects. Omit it and the crumbs are
   *  static text, which is what a surface with no write access to the tree should pass. */
  onRename?: (node: CategoryTreeNode, nextName: string) => void | Promise<void>
  /** Caption above the control (default) or beside it — see {@link Field}. */
  layout?: "stacked" | "inline"
  disabled?: boolean
  className?: string
}): React.ReactElement {
  const [renaming, setRenaming] = React.useState<CategoryTreeNode | null>(null)
  const [renameText, setRenameText] = React.useState("")
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const selected = nodeForName(nodes, value)
  const trail = selected ? categoryTrail(nodes, selected) : []

  function openRename(node: CategoryTreeNode): void {
    setRenaming(node)
    setRenameText(node.name)
    setRenameError(null)
  }

  async function commitRename(): Promise<void> {
    if (!renaming || !onRename) return
    const next = renameText.trim()
    if (next === "") {
      setRenameError(`A ${noun} needs a name.`)
      return
    }
    if (next === renaming.name) {
      setRenaming(null)
      return
    }
    // The generic CRUD update takes no uniqueness lock, so a rename onto an existing name would
    // mint a duplicate and break every read that keys on the name. Refuse it here, where the user
    // can still see what they typed.
    const taken =
      nodes.some((n) => n.id !== renaming.id && n.name.toLowerCase() === next.toLowerCase()) ||
      options.some(
        (o) => o.toLowerCase() !== renaming.name.toLowerCase() && o.toLowerCase() === next.toLowerCase(),
      )
    if (taken) {
      setRenameError(`There is already a ${noun} called “${next}”.`)
      return
    }
    try {
      setBusy(true)
      setRenameError(null)
      await onRename(renaming, next)
      // The field holds a NAME, so a rename of the node it points at has to move with it or the
      // draft would keep referring to a name that no longer exists.
      if (selected?.id === renaming.id) onChange(next)
      setRenaming(null)
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : `Could not rename the ${noun}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label={label} hint={hint} layout={layout} className={className}>
      <div className="flex w-full flex-col gap-2">
        {trail.length > 0 && (
          <nav aria-label={`${label} path`}>
            <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
              {trail.map((node, i) => (
                <li key={node.id} className="flex min-w-0 items-center gap-1">
                  {i > 0 && (
                    <ChevronRight size={12} aria-hidden className="shrink-0 text-apt-text-dim" />
                  )}
                  {onRename && !disabled ? (
                    <button
                      type="button"
                      onClick={() => openRename(node)}
                      aria-label={`Rename ${noun} ${node.name}`}
                      className={cn(
                        "truncate rounded font-mono text-xs tracking-[0.02em] outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40",
                        i === trail.length - 1 ? "text-apt-gold" : "text-apt-text-muted",
                      )}
                    >
                      {node.name}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        "truncate font-mono text-xs tracking-[0.02em]",
                        i === trail.length - 1 ? "text-apt-gold" : "text-apt-text-muted",
                      )}
                    >
                      {node.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex items-stretch gap-2">
          <Combobox
            items={options}
            value={value}
            onValueChange={onChange}
            ariaLabel={label}
            placeholder={`Type a ${noun}…`}
            disabled={disabled}
            className="flex-1"
          />
          <EntityChooser
            options={options}
            value={value || null}
            onChange={(next) => onChange(next ?? "")}
            ariaLabel={`Browse ${label.toLowerCase()}`}
            triggerLabel="Choose…"
            inputLabel={`Filter or add a ${noun}`}
            placeholder={`Filter or add a ${noun}…`}
            disabled={disabled}
            className="w-44 shrink-0"
          />
        </div>
      </div>

      {/* Rename lives in a modal rather than an inline edit because it is a write to the OWNER's
          vocabulary from inside a form that is editing something else — the confirm step is what
          keeps a stray click on a crumb from renaming a category everywhere it is used. */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRenaming(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename {noun}</DialogTitle>
            <DialogDescription>
              This renames it everywhere it is used.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameText}
            aria-label={`New ${noun} name`}
            disabled={busy}
            onChange={(e) => {
              setRenameText(e.target.value)
              setRenameError(null)
            }}
            onKeyDown={(e) => {
              // Enter commits from the field itself — a one-input dialog where the user has to
              // reach for the button is a dialog that gets in the way. Escape is the Dialog's own.
              if (e.key === "Enter") {
                e.preventDefault()
                void commitRename()
              }
            }}
          />
          <ErrorText error={renameError} />
          <DialogActions
            confirmLabel="Rename"
            onConfirm={() => void commitRename()}
            cancelLabel="Cancel"
            onCancel={() => setRenaming(null)}
            busy={busy}
            confirmDisabled={renameText.trim() === ""}
            // The input owns focus: this dialog is one field, and landing on a button would make
            // the first keystroke go nowhere.
            focusOnMount={false}
          />
        </DialogContent>
      </Dialog>
    </Field>
  )
}
