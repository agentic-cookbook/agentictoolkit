"use client";

import { useCallback, useSyncExternalStore } from "react";

import { readSearchParam, subscribeToSearchParams } from "../lib/search-params";

/**
 * Read one URL search param AS STATE — it re-renders when the param changes, whoever changed it:
 * a {@link writeSearchParams} call anywhere in the tree, or the browser's Back/Forward.
 *
 * Use it when a value's single representation is the URL rather than a `useState` beside it. That
 * is not a stylistic preference: a selection held in state and *mirrored* to the URL has two
 * copies, and every path that writes only one of them (a deep link, a reload, a sibling component
 * naming the same row) is a bug that renders correctly on the machine it was written on.
 *
 * SSR: the server snapshot is `null`, so a param never appears in server HTML. `useSyncExternalStore`
 * uses that same snapshot to hydrate and then re-renders with the real value, which is why this is
 * warning-free where reading `window.location` during render would not be.
 */
export function useSearchParam(key: string): string | null {
  const getSnapshot = useCallback(() => readSearchParam(key), [key]);
  return useSyncExternalStore(subscribeToSearchParams, getSnapshot, () => null);
}
