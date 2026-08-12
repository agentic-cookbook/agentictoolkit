"use client";

import { useResourceItemQuery, type ResourceItem } from "@agentic-toolkit/data";

import { useReportMissing } from "./rail-host";

export type { ResourceItem };

/**
 * One cached item, wired to the stack. The pane gets its item instantly from whatever is already
 * known, the read settles behind that paint, and if the item turns out to be GONE the host tells
 * the user and backs them out — the pane itself does neither.
 *
 * Two things a caller must do with what this returns:
 *  - bind `readOnly` (or `disabled`) to `!isSettled`, so a seed is never edited and then saved
 *    over the server's real copy;
 *  - feed `isFetching` to the level's `busy`, so the topic list shows the read is happening.
 *
 * It lives here rather than in `@agentic-toolkit/data` because it talks to the rail host, and
 * `data` must never depend on `resource`.
 */
export function useResourceItem<T>(
  cacheKey: string,
  id: string | null,
  load: (id: string) => Promise<T>,
  opts?: { seedFrom?: () => T | undefined; reportErrors?: boolean },
): ResourceItem<T> {
  const { isMissing, ...rest } = useResourceItemQuery(cacheKey, id, load, opts);
  // Report only. The host owns the alert AND the pop that follows it, so the stack comes apart
  // when the user acknowledges — not the instant a 404 lands under them.
  useReportMissing(id, isMissing);
  return rest;
}
