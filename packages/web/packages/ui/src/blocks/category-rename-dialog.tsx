"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/dialog"
import { DialogActions } from "../components/dialog-actions"
import { ErrorText } from "../components/error-text"
import { Input } from "../components/input"
import { useLastPresent } from "../hooks/useLastPresent"
import type { CategoryTreeNode } from "./category-tree"

export interface CategoryRenameDialogProps {
  open: boolean
  /** The category being renamed. `null` renders nothing — the host may keep the dialog
   *  mounted with no target between opens. */
  node: CategoryTreeNode | null
  /** The whole vocabulary, for the duplicate-name guard. */
  nodes: readonly CategoryTreeNode[]
  /** Extra names to treat as taken — a host whose autocomplete knows names the node list
   *  does not (one just minted elsewhere) passes them here. */
  extraNames?: readonly string[]
  /** Singular, lowercase, for the microcopy. Nothing here hardcodes "category". */
  noun: string
  /** May be async: the dialog spins until it settles and stays open, showing the reason,
   *  if it rejects. */
  onRename: (node: CategoryTreeNode, nextName: string) => void | Promise<void>
  /** Called after a successful rename with the new name, and on cancel with nothing. */
  onRenamed?: (node: CategoryTreeNode, nextName: string) => void
  onClose: () => void
}

/**
 * Renaming one category, in a modal.
 *
 * A rename is the one edit to the owner's vocabulary that is always safe from anywhere —
 * it moves nothing and unfiles nothing — which is why it is offered both from a form row's
 * breadcrumb ({@link CategoryField}) and from the rail's gear menu. The confirm step is
 * what keeps a stray click from renaming a category everywhere it is used.
 *
 * The duplicate guard is HERE rather than on the server round-trip because the generic CRUD
 * update takes no uniqueness lock: a rename onto an existing name would mint a duplicate and
 * break every read that keys on the name. Refusing it while the user can still see what they
 * typed is the difference between a correction and a corruption.
 */
export function CategoryRenameDialog({
  open,
  node: target,
  nodes,
  extraNames = [],
  noun,
  onRename,
  onRenamed,
  onClose,
}: CategoryRenameDialogProps): React.ReactElement | null {
  // The subject SURVIVES the host clearing it, for exactly as long as the exit animation
  // needs. Unmounting on the same tick the target went null cut the Dialog's `open → false`
  // transition off before it started, so this one popped where its siblings faded.
  const node = useLastPresent(target)
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Seeded from the LIVE target, not the held one: a value held only for the way out must
  // never re-seed the field, or reopening on nothing would restore the last rename's text.
  React.useEffect(() => {
    if (open && target) {
      setText(target.name)
      setError(null)
    }
  }, [open, target])

  if (!node) return null

  async function commit(): Promise<void> {
    if (!node) return
    const next = text.trim()
    if (next === "") {
      setError(`A ${noun} needs a name.`)
      return
    }
    if (next === node.name) {
      onClose()
      return
    }
    const taken =
      nodes.some((n) => n.id !== node.id && n.name.toLowerCase() === next.toLowerCase()) ||
      extraNames.some(
        (o) => o.toLowerCase() !== node.name.toLowerCase() && o.toLowerCase() === next.toLowerCase(),
      )
    if (taken) {
      setError(`There is already a ${noun} called “${next}”.`)
      return
    }
    try {
      setBusy(true)
      setError(null)
      await onRename(node, next)
      onRenamed?.(node, next)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not rename the ${noun}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename {noun}</DialogTitle>
          <DialogDescription>This renames it everywhere it is used.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={text}
          aria-label={`New ${noun} name`}
          disabled={busy}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            // Enter commits from the field itself — a one-input dialog where the user has to
            // reach for the button is a dialog that gets in the way. Escape is the Dialog's own.
            if (e.key === "Enter") {
              e.preventDefault()
              void commit()
            }
          }}
        />
        <ErrorText error={error} />
        <DialogActions
          confirmLabel="Rename"
          onConfirm={() => void commit()}
          cancelLabel="Cancel"
          onCancel={onClose}
          busy={busy}
          confirmDisabled={text.trim() === ""}
          // The input owns focus: this dialog is one field, and landing on a button would make
          // the first keystroke go nowhere.
          focusOnMount={false}
        />
      </DialogContent>
    </Dialog>
  )
}
