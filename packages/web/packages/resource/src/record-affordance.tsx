"use client";

// Host-injected per-record affordance. A host may supply a renderer (the hub
// supplies its api-explorer RecordApiButton) that master/detail panes drop into
// their button-bar `trailing` slot for the open record; standalone sites supply
// nothing → `useRecordAffordance()` returns null and panes render nothing there.

import { createContext, useContext, type ReactNode } from "react";

/** The props a pane hands the affordance for the open record — the exact prop surface of the hub's
 *  RecordApiButton (a record endpoint + its path/query placeholder values), so the hub's renderer
 *  drops in unchanged. */
export interface RecordAffordanceProps {
  /** HTTP verb to focus. Defaults to the item read (GET). */
  method?: string;
  /** Backend-native path (no `/api` prefix), e.g. `/team/teams/{id}`. */
  path: string;
  /** Values for the path placeholders; the affordance hides while any is missing. */
  pathValues: Record<string, string | null | undefined>;
  /** Optional query params to seed (e.g. a collection scoped by `?teamId=`). */
  queryValues?: Record<string, string | null | undefined>;
  /** Dialog heading, e.g. `"Team API"`. */
  title?: string;
}

export type RecordAffordanceRenderer = (props: RecordAffordanceProps) => ReactNode;

/** The host-injected renderer, or null when no host supplies one. */
export const RecordAffordanceContext = createContext<RecordAffordanceRenderer | null>(null);

/** Read the host's per-record affordance renderer (null → panes render nothing in the slot). */
export function useRecordAffordance(): RecordAffordanceRenderer | null {
  return useContext(RecordAffordanceContext);
}
