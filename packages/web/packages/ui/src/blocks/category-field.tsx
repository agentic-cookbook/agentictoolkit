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

/** One category in the owner's hierarchy. It is a DAG: `parentIds` may hold any number of
 *  parents, or none, so a category can sit in several places at once. The walk below also
 *  tolerates a parent id naming no node, and a cycle, rather than trusting the data. */
export interface CategoryTreeNode {
  id: string
  name: string
  parentIds: string[]
}

/** How many trails one value may show. A DAG has exponentially many paths and this is a form
 *  row; past a handful, the breadcrumb stops being the thing that made the name legible. */
const MAX_TRAILS = 4

/**
 * Every path from a root down to `leaf`, each outermost-first — one per place the category is
 * filed. Guards a broken graph three ways: a parent id naming no node ends that branch, a
 * parent already on the current path is skipped (so a cycle cannot recur), and the result is
 * capped. The caller always gets at least one trail — `[leaf]` for a category with no
 * reachable parent — never a hang.
 */
export function categoryTrails(
  nodes: readonly CategoryTreeNode[],
  leaf: CategoryTreeNode,
): CategoryTreeNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const trails: CategoryTreeNode[][] = []
  const walk = (node: CategoryTreeNode, below: CategoryTreeNode[], onPath: Set<string>): void => {
    if (trails.length >= MAX_TRAILS) return
    const trail = [node, ...below]
    const parents = [...new Set(node.parentIds)]
      .filter((id) => id !== node.id && !onPath.has(id))
      .map((id) => byId.get(id))
      .filter((p): p is CategoryTreeNode => p !== undefined)
    if (parents.length === 0) {
      trails.push(trail)
      return
    }
    onPath.add(node.id)
    for (const parent of parents) walk(parent, trail, onPath)
    onPath.delete(node.id)
  }
  walk(leaf, [], new Set())
  return trails
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
 * The family's CATEGORY editor: one form row for "this thing carries one category from a
 * hierarchy the owner maintains".
 *
 * Same `[Combobox autocomplete] + [Choose… browser]` pair as {@link TagSetField}, for the same
 * reason — the Combobox is for the category you can name, the chooser is for the one you have to
 * go and find, and it is also where a new one is minted. Two things are category-specific:
 *
 *  - **The value is shown as a BREADCRUMB, not a bare name** — one per place the category is
 *    filed, because the vocabulary is a DAG and a category may sit under several parents.
 *    A flat name tells the user which name they picked but not where it sits.
 *  - **A crumb is clickable, and renames.** The hierarchy is edited from wherever it is
 *    displayed rather than only from a separate management screen — the rename is the one edit
 *    that is always safe from here, because a rename moves nothing.
 *
 * The picker itself stays FLAT (names, not a tree walk): a name is unique per owner across the
 * whole hierarchy, so a name already names one category and typing three characters beats
 * navigating three levels. The breadcrumbs are what make the flat pick legible afterwards —
 * and the only place the second filing of a category is visible from a form.
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
  /** The hierarchy behind those names, when the host has it. Drives the breadcrumbs and the
   *  rename; omit it and the value renders as the single name it is. */
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
  const trails = selected ? categoryTrails(nodes, selected) : []

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
        {/* One breadcrumb per filing. Usually one line; a category filed under two parents
            shows both, because "which of them" is not a question this row can answer for the
            user — and a single line would silently pick one. */}
        {trails.length > 0 && (
          <nav aria-label={trails.length > 1 ? `${label} paths` : `${label} path`}>
            {trails.map((trail) => (
              <ol
                key={trail.map((node) => node.id).join("/")}
                className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5"
              >
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
            ))}
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
