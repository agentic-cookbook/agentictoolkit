"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// Every MOUNTED list's `reload`, keyed by the same `cacheKey` the cache uses. The cache above
// is only a seed — each hook instance holds its own React state — so there is no way to make a
// mounted list re-read from outside it without one. This is that one.
//
// It exists for the live streams: a server-sent "something changed" arrives at the feature root
// with no idea which panes are open, and the alternative is threading a `reload` up out of every
// list to a coordinator that then has to be told about each new one. Registering here inverts
// that — a list is revalidatable by virtue of being mounted, and a pane added tomorrow is live
// without anyone remembering to wire it.
const mounted = new Map<string, Set<() => Promise<void>>>();

/**
 * Re-read every MOUNTED list whose cache key `match` accepts. Unmounted lists are not in the
 * map, so nothing is fetched for a pane nobody is looking at; the module cache is left alone
 * and re-seeds on the next mount from the read that lands.
 *
 * Failures are swallowed HERE and only here: a revalidation nobody asked for must not surface
 * as an unhandled rejection, and each hook has already recorded the failure in its own `error`,
 * which is where a pane shows it. Fire-and-forget by design — the caller is a wake signal, not
 * a transaction.
 */
export function revalidateResources(match: (cacheKey: string) => boolean): void {
  for (const [cacheKey, reloads] of mounted) {
    if (!match(cacheKey)) continue;
    // Snapshot: a list may unmount while the set is being walked.
    for (const reload of [...reloads]) void reload().catch(() => {});
  }
}

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
  /** Re-fetch the list (e.g. after a create/delete) and update the cache. Always hits the
   *  network. Safe to have several in flight: only the most recently ISSUED request may write
   *  the rows, so an overtaken response cannot revert the list (see the order guard below). The
   *  returned promise still rejects for its own caller either way. */
  reload: () => Promise<void>;
  /** The last load error, or null. */
  error: string | null;
  /** True while a read is in flight — including the very first one, before `items` has ever
   *  been anything but null.
   *
   *  `items` alone cannot answer "have I seen the server's answer yet", and that is the
   *  question a caller has to ask before treating an absence as a fact. Non-null only means
   *  SOME rows are on screen, which the module cache supplies on the first render after a
   *  remount — so a row created since that seed was written is missing from a list that reads
   *  as fully loaded, for exactly as long as the refetch takes. A caller that merely renders
   *  those rows is right to ignore this; a caller that concludes something from a row NOT
   *  being there (404, "no such workspace") has to wait for it to be false. */
  isFetching: boolean;
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
  // Starts TRUE, not false: the mount effect below always fetches, so there is a read in flight
  // from the first render onwards and the honest initial answer is "not settled". Starting false
  // would give every consumer one render in which a cache seed — or nothing at all — reads as the
  // server's final word, which is the exact window this flag exists to close.
  const [isFetching, setIsFetching] = useState(true);

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

  // ORDER GUARD. A reload-after-write pattern (add a row, then `reload()`; remove a row, then
  // `reload()` again) puts two GETs in flight at once, and nothing makes an earlier request
  // resolve first. Without this, the stale response is simply the last writer to `setItemsState`
  // and the list reverts to a state the server has already moved past — visibly, and only
  // sometimes, which is the worst kind of only-sometimes. So every fetch takes a ticket and only
  // the LATEST one may write state; an overtaken response is dropped.
  //
  // It guards the STATE WRITE, not the call: `reload()` still rejects for its own caller, so a
  // failed write's error handling is unaffected by a newer request having been issued.
  const seq = useRef(0);

  // Deliberately does NOT write the cache: a losing response must not leave its rows behind for
  // the next mount to seed from, which would resurrect the stale list one navigation later —
  // the same defect, just deferred to where nobody would connect it to a double write. The
  // winner stores, below.
  const fetchRows = useCallback(async () => load(), [load]);

  // `isFetching` follows the same ticket as the state write, and for the same reason: only the
  // LATEST request may clear it. An overtaken response returning first would otherwise announce
  // "settled" while the request whose rows will actually land is still out.
  const reload = useCallback(async () => {
    const ticket = ++seq.current;
    setIsFetching(true);
    try {
      const rows = await fetchRows();
      if (ticket !== seq.current) return;
      store(rows);
      setError(null);
      setItemsState(rows);
      setIsFetching(false);
    } catch (e) {
      reportUnexpectedAuthError(e, { feature: "resource-list", step: "reload", basePath: cacheKey });
      if (ticket === seq.current) {
        setError(e instanceof Error ? e.message : "Failed to load.");
        setIsFetching(false);
      }
      throw e;
    }
  }, [fetchRows, store, cacheKey]);

  // Publish this list's `reload` for as long as it is mounted, so a live wake can revalidate it
  // without holding a reference to the component (see `revalidateResources`). Re-runs when
  // `reload` changes identity — a new fetcher — which simply re-registers the current one.
  useEffect(() => {
    let set = mounted.get(cacheKey);
    if (!set) {
      set = new Set();
      mounted.set(cacheKey, set);
    }
    const reloads = set;
    reloads.add(reload);
    return () => {
      reloads.delete(reload);
      if (reloads.size === 0) mounted.delete(cacheKey);
    };
  }, [cacheKey, reload]);

  // Refetch on mount and whenever the tenant changes (so an account switch can't leave another
  // tenant's rows on screen). The cache seeds the first paint (see the note above — that seed is
  // what stops the remount flicker); this is the authoritative read that settles behind it.
  useEffect(() => {
    const ticket = ++seq.current;
    let alive = true;
    setIsFetching(true);
    fetchRows()
      .then((rows) => {
        if (!alive || ticket !== seq.current) return;
        store(rows);
        setError(null);
        setItemsState(rows);
        setIsFetching(false);
      })
      .catch((e) => {
        reportUnexpectedAuthError(e, { feature: "resource-list", step: "load", basePath: cacheKey });
        if (alive && ticket === seq.current) {
          setError(e instanceof Error ? e.message : "Failed to load.");
          setIsFetching(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [fetchRows, store, cacheKey]);

  return { items, reload, error, isFetching, setItems };
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
