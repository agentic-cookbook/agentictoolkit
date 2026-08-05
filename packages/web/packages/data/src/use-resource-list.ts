"use client";

import { useCallback, useEffect, useState } from "react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { useTenantId } from "./tenant";
import { readLastId, clearLastId } from "./ftd-storage";

// Module-level cache of the last fetched rows per collection (keyed by the
// resource `basePath`). The App Router re-instantiates a tab on every entity
// switch, so without a seed the selector + panes blank to null on each navigation
// (flashing the popup label). `scope` records the tenant the rows belong to so a
// different identity (an account switch without a full reload) can never read
// another tenant's stale rows. `at` is when the rows were fetched — see FRESH_MS.
interface CacheBox<T> {
  scope: string | null;
  rows: T[] | null;
  at: number;
}
const caches = new Map<string, CacheBox<unknown>>();

// NOTE — why there is no "skip the fetch if the cache is fresh" window here.
//
// Next 16 REMOUNTS the page subtree on a same-segment param navigation, and everything a feature's
// URL grammar names below the workspace (`/<ws>/<project>/<topic>/<leaf>` on the projects site)
// lives on ONE catch-all segment — so every click tears the feature down and rebuilds it, and each
// mount re-reads. A staleness window would make
// those re-reads free, but it would also mean a list that STARTS failing keeps serving its last
// good rows for the length of the window, so a broken backend shows no error. That trade is not
// ours to make for every feature on the platform, and it is not needed for the flicker: the CACHE
// SEED below is what stops it. `items` is non-null on the first render after a remount, so the view
// repaints immediately from cache and the re-read settles behind it, invisibly. Keep it that way —
// the seed fixes what the user sees; the fetch keeps the data honest.
export interface ResourceList<T> {
  /** The rows (null = still loading), seeded from the tenant-scoped cache. */
  items: T[] | null;
  /** Re-fetch the list (e.g. after a create/delete) and update the cache. Always hits the network. */
  reload: () => Promise<void>;
  /** The last load error, or null. */
  error: string | null;
  /** Replace the rows locally — an optimistic update — writing through to the cache so the value
   *  survives the remount too. Takes the next rows or an updater, like a React setter. */
  setItems: (next: T[] | null | ((prev: T[] | null) => T[] | null)) => void;
}

/**
 * Shared list state for a resource tab (Ecosystems / Teams / Persona APIs): fetch
 * `load()` on mount, cache it at module scope keyed by `cacheKey` (the resource
 * `basePath`) + the current tenant, and expose `reload()` for post-mutation
 * refresh. Replaces the per-tab copy-pasted `let cache; useState(() => cache);
 * useEffect(fetch)` blocks with one place. Seeding from the cache is
 * stale-while-revalidate — the effect below always refetches.
 *
 * @param load Fetch the rows. MUST be referentially stable — a module-scope
 *   function (e.g. `projectsApi.list`) or a `useCallback`. It is a dependency of
 *   the fetch effect, and a NEW identity intentionally triggers a refetch (the
 *   refetch-on-identity-change API — e.g. swapping the fetcher when a filter
 *   changes). An inline closure recreated every render is therefore a bug: it
 *   would re-run the effect on every render and loop.
 */
export function useResourceList<T>(
  cacheKey: string,
  load: () => Promise<T[]>,
): ResourceList<T> {
  const tenantId = useTenantId();
  // Only ever read the cache for the CURRENT tenant — an account switch without a full reload must
  // never surface another tenant's rows.
  const cached = useCallback((): CacheBox<T> | null => {
    const box = caches.get(cacheKey) as CacheBox<T> | undefined;
    return box && box.scope === tenantId ? box : null;
  }, [cacheKey, tenantId]);

  const [items, setItemsState] = useState<T[] | null>(() => cached()?.rows ?? null);
  const [error, setError] = useState<string | null>(null);

  const store = useCallback(
    (rows: T[] | null) => {
      caches.set(cacheKey, { scope: tenantId, rows, at: Date.now() });
    },
    [cacheKey, tenantId],
  );

  // An optimistic local write, mirrored into the cache so it survives the page remount that a
  // navigation triggers (otherwise the next mount would seed from pre-write rows and the update
  // would appear to roll itself back).
  const setItems = useCallback<ResourceList<T>["setItems"]>(
    (next) => {
      setItemsState((prev) => {
        const rows = typeof next === "function" ? next(prev) : next;
        caches.set(cacheKey, { scope: tenantId, rows, at: cached()?.at ?? Date.now() });
        return rows;
      });
    },
    [cacheKey, tenantId, cached],
  );

  const fetchRows = useCallback(async () => {
    const rows = await load();
    store(rows);
    return rows;
  }, [load, store]);

  const reload = useCallback(async () => {
    try {
      const rows = await fetchRows();
      setError(null);
      setItemsState(rows);
    } catch (e) {
      reportUnexpectedAuthError(e, { feature: "resource-list", step: "reload", basePath: cacheKey });
      setError(e instanceof Error ? e.message : "Failed to load.");
      throw e;
    }
  }, [fetchRows, cacheKey]);

  // Refetch on mount and whenever the tenant changes (so an account switch can't leave another
  // tenant's rows on screen). The cache seeds the first paint (see the note above — that seed is
  // what stops the remount flicker); this is the authoritative read that settles behind it.
  useEffect(() => {
    let alive = true;
    fetchRows()
      .then((rows) => {
        if (alive) {
          setError(null);
          setItemsState(rows);
        }
      })
      .catch((e) => {
        reportUnexpectedAuthError(e, { feature: "resource-list", step: "load", basePath: cacheKey });
        if (alive) setError(e instanceof Error ? e.message : "Failed to load.");
      });
    return () => {
      alive = false;
    };
  }, [fetchRows, cacheKey]);

  return { items, reload, error, setItems };
}

/** Minimal slice of the Next router this module needs. */
type PushRouter = { push: (href: string, opts?: { scroll?: boolean }) => void };

/**
 * The shared FTD entity-delete handler for a tab's Danger-zone delete: delete the
 * entity, forget it as the resume target (FTD spec §8 — and stop a future entity
 * that reuses the freed id from auto-resuming), navigate to the All view first so
 * a failed list refresh can't strand the user on the dead pane, then best-effort
 * refresh. Replaces the same closure copy-pasted across the three tabs.
 */
export function makeEntityDeleteHandler(opts: {
  basePath: string;
  id: string;
  router: PushRouter;
  del: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}): () => Promise<void> {
  const { basePath, id, router, del, reload } = opts;
  return async () => {
    await del(id);
    if (readLastId(basePath) === id) clearLastId(basePath);
    router.push(`${basePath}/all`, { scroll: false });
    try {
      await reload();
    } catch {
      // swallowed: the popup reconciles on its next load
    }
  };
}
