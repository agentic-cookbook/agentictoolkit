"use client"

import * as React from "react"

import { AlertModal } from "../components/alert-modal"
import { DialogErrorText } from "../components/error-text"
import { useLastPresent } from "../hooks/useLastPresent"
import type { CategoryTreeNode } from "./category-tree"

export interface CategoryDeleteDialogProps {
  open: boolean
  /** The category to delete. `null` renders nothing. */
  node: CategoryTreeNode | null
  /** Names of the descendants that will go with it — the ones filed nowhere else. Empty
   *  when nothing is orphaned. The host computes this from the same forest the rail draws,
   *  so the warning matches what the user is looking at. */
  orphanedNames?: readonly string[]
  /** What the categorized things are called here, plural and lowercase: "notes",
   *  "documents". Nothing in this component decides the host's vocabulary. */
  itemNoun: string
  error?: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirming the deletion of one category.
 *
 * The copy carries the whole semantic, because this is the only moment the user can learn
 * it: deleting a category deletes the FILING, never the filed thing. A note in the deleted
 * category becomes an uncategorized note — it is not touched, let alone removed. What can
 * disappear is other CATEGORIES: a child filed only here has nowhere left to be, so it goes
 * too, while a child also filed elsewhere stays. Naming those children by name is what makes
 * the difference visible before the click rather than after it.
 */
export function CategoryDeleteDialog({
  open,
  node: target,
  orphanedNames = [],
  itemNoun,
  error = null,
  busy = false,
  onConfirm,
  onCancel,
}: CategoryDeleteDialogProps): React.ReactElement | null {
  // Held past the host clearing it, so the confirmation fades out reading the name it was
  // asking about rather than vanishing mid-transition. See {@link useLastPresent}.
  const node = useLastPresent(target)
  if (!node) return null
  return (
    <AlertModal
      open={open}
      tone="error"
      title={`Delete “${node.name}”?`}
      destructive
      confirmLabel="Delete"
      cancelLabel="Cancel"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
      description={
        /* Every child here is a block-displayed `<span>`, never a `<p>`, for the reason
         * `DialogErrorText` is written down beside: `AlertModal` puts this whole fragment
         * inside `DialogDescription`, which Base UI renders as a `<p>`, and a `<p>` may not
         * nest in a `<p>`. The browser closes the outer one and re-parents what follows, so
         * the paragraphs land OUTSIDE the described element — the dialog's accessible
         * description silently loses the sentence that carries this dialog's whole meaning,
         * and React reports it only as a hydration error. `block` keeps each on its own line,
         * so the rendering is the one the copy was written for. */
        <>
          <span className="block">
            This deletes the category only. Any {itemNoun} filed under it{" "}
            <strong>are not deleted</strong> — they become uncategorized.
          </span>
          {orphanedNames.length > 0 && (
            <span className="mt-2 block">
              {orphanedNames.length === 1
                ? "This subcategory is filed nowhere else, so it is deleted too:"
                : "These subcategories are filed nowhere else, so they are deleted too:"}{" "}
              <strong>{orphanedNames.join(", ")}</strong>. Their {itemNoun} become
              uncategorized as well.
            </span>
          )}
          <DialogErrorText error={error} />
        </>
      }
    />
  )
}
