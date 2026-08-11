"use client"

import * as React from "react"

/**
 * NESTING — how a row editor's unsaved work reaches the page's navigation guard.
 *
 * Containers nest: a table of rows sits inside a settings pane, and each open row
 * is its own container with its own Save. Those two facts have to hold at once:
 *
 * - The INNER container owns its own Save/Cancel. Saving a row is a complete act;
 *   it must not require the outer pane to be saved as well.
 * - The OUTER container owns the navigation prompt. Backing out of the table with
 *   a half-edited row must warn, even though the outer pane's own fields are
 *   untouched.
 *
 * So dirtiness rolls UP and the guard is published ONCE, by the outermost
 * container. Each container reports its aggregate (own fields OR any descendant)
 * to its parent, and the root — the one with no parent scope — is the only one
 * that renders a guard. Two guards for one page would be two prompts for one
 * decision, which is exactly the failure the navigation registry's primary rule
 * exists to avoid; not creating the second guard is cheaper than de-duplicating it.
 *
 * A child that unmounts mid-edit clears its report, so a dismissed row does not
 * leave the page permanently "dirty" and unable to navigate.
 */

export interface EditingScope {
  /**
   * A descendant publishes its aggregate dirtiness under a stable id.
   *
   * The scope carries only this. A container's DEPTH is deliberately absent: the
   * one question the nesting has to answer is "am I the root", and that is
   * `parent === null` — reachable without anyone counting. A depth number would be
   * a second way to ask it, free to disagree.
   */
  reportDirty(id: string, dirty: boolean): void
}

const EditingScopeContext = React.createContext<EditingScope | null>(null)

/** The enclosing container's scope, or null at the root. */
export function useParentEditingScope(): EditingScope | null {
  return React.useContext(EditingScopeContext)
}

export interface DirtyRollup {
  /** This container's own dirtiness OR any descendant's. */
  readonly aggregateDirty: boolean
  /** True when nothing encloses this container — the guard owner. */
  readonly isRoot: boolean
  /** The scope to publish to descendants. */
  readonly scope: EditingScope
}

/**
 * Aggregate `ownDirty` with every descendant container's report, publish the
 * result to the parent, and hand back the scope descendants report into.
 */
export function useDirtyRollup(ownDirty: boolean): DirtyRollup {
  const parent = React.useContext(EditingScopeContext)
  const id = React.useId()
  const [dirtyChildren, setDirtyChildren] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  const reportDirty = React.useCallback((childId: string, dirty: boolean) => {
    setDirtyChildren((previous) => {
      // Bail on a report that changes nothing: the child re-reports on every
      // render of its own effect, and returning a fresh Set each time would
      // re-render this container (and therefore the child) forever.
      if (previous.has(childId) === dirty) return previous
      const next = new Set(previous)
      if (dirty) next.add(childId)
      else next.delete(childId)
      return next
    })
  }, [])

  const aggregateDirty = ownDirty || dirtyChildren.size > 0

  // Publish upward. Split from the unmount cleanup below so a change of
  // `aggregateDirty` does not report `false` on the way to reporting `true` —
  // a transient clean moment would let a guard disarm and re-arm, and
  // UnsavedChangesGuard pushes a history sentinel when it arms.
  React.useEffect(() => {
    parent?.reportDirty(id, aggregateDirty)
  }, [parent, id, aggregateDirty])

  React.useEffect(() => {
    return () => {
      parent?.reportDirty(id, false)
    }
  }, [parent, id])

  const scope = React.useMemo<EditingScope>(() => ({ reportDirty }), [reportDirty])

  return { aggregateDirty, isRoot: parent === null, scope }
}

/** Publishes `scope` to descendant containers. */
export function EditingScopeProvider({
  scope,
  children,
}: {
  scope: EditingScope
  children: React.ReactNode
}): React.ReactElement {
  return <EditingScopeContext.Provider value={scope}>{children}</EditingScopeContext.Provider>
}
