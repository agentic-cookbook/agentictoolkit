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
// another tenant's stale rows.
interface CacheBox<T> {
  scope: string | null;
  rows: T[] | null;
}
const caches = new Map<string, CacheBox<unknown>>();

export interface ResourceList<T> {
  /** The rows (null = still loading), seeded from the tenant-scoped cache. */
  items: T[] | null;
  /** Re-fetch the list (e.g. after a create/delete) and update the cache. */
  reload: () => Promise<void>;
  /** The last load error, or null. */
  error: string | null;
}

/**
 * Shared list state for a resource tab (Ecosystems / Teams / Persona APIs): fetch
 * `load()` on mount, cache it at module scope keyed by `cacheKey` (the resource
 * `basePath`) + the current tenant, and expose `reload()` for post-mutation
 * refresh. Replaces the per-tab copy-pasted `let cache; useState(() => cache);
 * useEffect(fetch)` blocks with one place. Seeding from the cache is
 * stale-while-revalidate — the effect below always refetches.
 */
export function useResourceList<T>(
  cacheKey: string,
  load: () => Promise<T[]>,
): ResourceList<T> {
  const tenantId = useTenantId();
  const [items, setItems] = useState<T[] | null>(() => {
    // Only seed from the cache when it belongs to the current tenant.
    const box = caches.get(cacheKey) as CacheBox<T> | undefined;
    return box && box.scope === tenantId ? box.rows : null;
  });
  const [error, setError] = useState<string | null>(null);

  const store = useCallback(
    (rows: T[]) => {
      caches.set(cacheKey, { scope: tenantId, rows });
    },
    [cacheKey, tenantId],
  );

  const reload = useCallback(async () => {
    try {
      const rows = await load();
      store(rows);
      setError(null);
      setItems(rows);
    } catch (e) {
      reportUnexpectedAuthError(e, { feature: "resource-list", step: "reload", basePath: cacheKey });
      setError(e instanceof Error ? e.message : "Failed to load.");
      throw e;
    }
  }, [load, store, cacheKey]);

  // Refetch on mount and whenever the tenant changes (so an account switch can't
  // leave another tenant's rows on screen). The cache only ever seeds the first
  // paint; this is the authoritative read.
  useEffect(() => {
    let alive = true;
    load()
      .then((rows) => {
        store(rows);
        if (alive) {
          setError(null);
          setItems(rows);
        }
      })
      .catch((e) => {
        reportUnexpectedAuthError(e, { feature: "resource-list", step: "load", basePath: cacheKey });
        if (alive) setError(e instanceof Error ? e.message : "Failed to load.");
      });
    return () => {
      alive = false;
    };
  }, [load, store, cacheKey]);

  return { items, reload, error };
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
