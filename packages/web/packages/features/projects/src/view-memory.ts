"use client";

import { useCallback, useState } from "react";
import { EMPTY_FILTER, type WorkItemFilter } from "./filters";
import type { SortState } from "./views/TableView";

/**
 * What the Work Items surface remembers about how you are looking at a project, ACROSS the
 * remount that switching views performs.
 *
 * Switching view is a navigation, and everything the Projects URL grammar names below the
 * workspace sits on one catch-all segment — so Next tears the whole feature down and rebuilds it
 * on every click (the same fact `useResourceList`'s module cache exists for). Plain `useState` in
 * the surface therefore cannot hold the narrowing: a filter typed while looking at the List would
 * be gone the moment you looked at the same cards on the Board, which is the opposite of what the
 * five views promise. Worse for saved views — a view whose stored `view` is the Board is applied
 * BY navigating to the Board, so a filter that dies on that navigation is a saved view that
 * applies nothing.
 *
 * So the value is kept at module scope, keyed by project, and `useState` is SEEDED from it. It is
 * a memory of what the user is looking at, not a second source of truth: every write goes through
 * the setter below, nothing reads the map directly, and a project nobody narrows never appears in
 * it. It is deliberately not persisted anywhere — a filter is a thing you are doing, not a
 * setting, and the one that deserves to outlive the tab is the one you gave a name to.
 *
 * The active VIEW is not here: that one IS the URL (`…/work-items/<view>`), and a second copy of
 * it would be a second answer to the same question.
 */
export interface RememberedView {
  filter: WorkItemFilter;
  /** The Table's column sort. Lifted out of the Table so a saved view can carry it, and so the
   *  ordering survives a trip through the Board and back. */
  sort: SortState | null;
  /** The saved view this configuration came from, or null when nobody has named it. */
  savedViewId: string | null;
}

const BLANK: RememberedView = { filter: EMPTY_FILTER, sort: null, savedViewId: null };

const remembered = new Map<string, RememberedView>();

/** Forget every project's narrowing. For tests — module state outlives a `render()`. */
export function resetViewMemory(): void {
  remembered.clear();
}

export function useViewMemory(
  projectId: string,
): [RememberedView, (patch: Partial<RememberedView>) => void] {
  const [box, setBox] = useState<{ id: string; view: RememberedView }>(() => ({
    id: projectId,
    view: remembered.get(projectId) ?? BLANK,
  }));

  // Derived rather than synced in an effect: if this pane is ever re-rendered for a DIFFERENT
  // project without remounting, the previous project's filter must not be on screen for even one
  // frame — and an effect would put it there.
  const view = box.id === projectId ? box.view : remembered.get(projectId) ?? BLANK;

  const patch = useCallback(
    (next: Partial<RememberedView>) => {
      setBox((prev) => {
        const base = prev.id === projectId ? prev.view : remembered.get(projectId) ?? BLANK;
        const merged = { ...base, ...next };
        remembered.set(projectId, merged);
        return { id: projectId, view: merged };
      });
    },
    [projectId],
  );

  return [view, patch];
}
