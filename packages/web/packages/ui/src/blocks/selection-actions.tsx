"use client"

import * as React from "react"

import { Trash2 } from "lucide-react"
import { AlertModal } from "../components/alert-modal"
import { Button } from "../components/button"

/**
 * What a multi-selection is FOR: the strip of ghost buttons that act on the selected rows, plus
 * the destructive Delete behind its confirmation.
 *
 * It lives on its own rather than inside {@link ListWithDetailsPane} because selection is not the
 * details pane's idea. A dense table with no details pane has exactly the same selection and
 * exactly the same things to do with it, and the knowledge worth keeping in one place is the
 * BEHAVIOUR — an action that needs a selection is disabled without one, a divider is a real
 * toolbar separator rather than a decorative rule, and Delete is never immediate. Restating that
 * per surface is how two lists end up disagreeing about whether an empty selection greys a button
 * out or throws.
 *
 * It renders no container of its own: the caller drops it into a {@link ListHeader}'s `actions`
 * slot, which is what puts it in the same recessed strip every toolbar uses.
 */

export interface ListAction {
  id: string
  label: React.ReactNode
  onClick: (selectedIds: string[]) => void
  /** Greyed out until at least one row is selected. Omit for an action that stands on its own
   *  (a "New…" that needs no selection at all). */
  requiresSelection?: boolean
  dividerBefore?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
}

export interface SelectionActionsProps {
  /** The rows currently selected. The caller has already pruned ids that left the list, so this
   *  is what the actions will actually receive. */
  selectedIds: string[]
  actions?: ListAction[]
  /** Omit for a list nothing can be deleted from — the Delete button disappears with it. Called
   *  only after the user confirms. */
  onDelete?: (selectedIds: string[]) => void
  deleteConfirm?: { title: string; description?: React.ReactNode }
}

export function SelectionActions({
  selectedIds,
  actions = [],
  onDelete,
  deleteConfirm,
}: SelectionActionsProps): React.ReactElement {
  const [confirming, setConfirming] = React.useState(false)

  return (
    <>
      {actions.map((action) => (
        <React.Fragment key={action.id}>
          {action.dividerBefore && (
            // A real toolbar separator (ARIA toolbar pattern) so AT users
            // perceive the grouping the divider marks, not a decorative rule.
            <div
              role="separator"
              aria-orientation="vertical"
              className="mx-1 h-5 w-px bg-apt-border"
            />
          )}
          <Button
            size="sm"
            variant={action.variant ?? "ghost"}
            disabled={action.requiresSelection === true && selectedIds.length === 0}
            onClick={() => action.onClick(selectedIds)}
          >
            {action.label}
          </Button>
        </React.Fragment>
      ))}
      {onDelete && (
        <Button
          size="sm"
          variant="destructive-ghost"
          disabled={selectedIds.length === 0}
          onClick={() => setConfirming(true)}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      )}
      {onDelete && (
        <AlertModal
          open={confirming}
          destructive
          title={deleteConfirm?.title ?? "Delete selected?"}
          description={deleteConfirm?.description}
          cancelLabel="Cancel"
          onCancel={() => setConfirming(false)}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirming(false)
            onDelete(selectedIds)
          }}
        />
      )}
    </>
  )
}
