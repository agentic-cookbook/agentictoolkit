"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { getToolkitQueryClient } from "./query";
import { useTenantId } from "./tenant";
import { readLastId, clearLastId } from "./ftd-storage";

// Every resource list lives in the toolkit's ONE QueryClient under this key. The tenant is a key
// SEGMENT, not a scope check on a box of rows: an account switch without a full reload simply
// reads a DIFFERENT key, so there is no path by which one identity can be handed another's rows.
function resourceListKey(cacheKey: string, tenantId: string | null): QueryKey {
  return ["resource-list", tenantId, cacheKey];
}

/**
 * Re-read every list whose cache key `match` accepts. A MOUNTED list refetches immediately; an
 * unmounted one is only marked stale, so nothing is fetched for a pane nobody is looking at and
 * the next mount re-reads rather than serving rows the wake already knew were out of date.
 *
 * It exists for the live streams: a server-sent "something changed" arrives at the feature root
 * with no idea which panes are open. A list is revalidatable by virtue of being in the cache, so
 * a pane added tomorrow is live without anyone remembering to wire it.
 *
 * Failures are swallowed HERE and only here: a revalidation nobody asked for must not surface as
 * an unhandled rejection, and each hook has already recorded the failure in its own `error`,
 * which is where a pane shows it. Fire-and-forget by design — the caller is a wake signal, not a
 * transaction.
 */
export function revalidateResources(match: (cacheKey: string) => boolean): void {
  void getToolkitQueryClient()
    .invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === "resource-list" && typeof key[2] === "string" && match(key[2]);
      },
    })
    .catch(() => {});
}

export interface ResourceList<T> {
  /** The rows (null = nothing cached and nothing read yet), served instantly from the query cache
   *  on a remount. */
  items: T[] | null;
  /** Re-fetch the list (e.g. after a create/delete) and update the cache. Always hits the
   *  network. Safe to have several in flight: an overtaken request is cancelled, so a stale
   *  response cannot revert the list. The returned promise still rejects for its own caller. */
  reload: () => Promise<void>;
  /** The last load error, or null. */
  error: string | null;
  /** True while a read is in flight, INCLUDING the very first one before `items` has ever been
   *  anything but null.
   *
   *  `items` alone cannot answer "have I seen the server's answer yet", and that is the question
   *  a caller has to ask before treating an absence as a fact. Non-null only means SOME rows are
   *  on screen, which the query cache supplies on the first render after a remount — so a row
   *  created since those rows were fetched is missing from a list that reads as fully loaded, for
   *  exactly as long as the refetch takes. A caller that merely renders the rows is right to
   *  ignore this; a caller that CONCLUDES something from a row not being there (404, "no such
   *  workspace") has to wait for it to be false.
   *
   *  Cached rows within `staleTime` do NOT trigger a read, so this is false on that paint. That
   *  is not a gap: those rows are the server's answer from under five minutes ago. Force a read
   *  with `revalidateResources` when a caller needs one sooner. */
  isFetching: boolean;
  /** Replace the rows locally — an optimistic update — writing through to the cache so the value
   *  survives the remount too. Takes the next rows or an updater, like a React setter. */
  setItems: (next: T[] | null | ((prev: T[] | null) => T[] | null)) => void;
}

/**
 * Shared list state for a resource tab (Ecosystems / Teams / Persona APIs): read `load()` into the
 * toolkit's query cache under `cacheKey` + the current tenant, paint whatever is cached instantly,
 * and revalidate behind that paint. Replaces the per-tab copy-pasted
 * `let cache; useState(() => cache); useEffect(fetch)` blocks with one place.
 *
 * @param load Fetch the rows. MUST be referentially stable — a module-scope function (e.g.
 *   `projectsApi.list`) or a `useCallback`. A NEW identity intentionally triggers a refetch (the
 *   refetch-on-identity-change API — e.g. swapping the fetcher when a filter changes). An inline
 *   closure recreated every render is therefore a bug: it would re-read on every render and loop.
 */
export function useResourceList<T>(
  cacheKey: string,
  load: () => Promise<T[]>,
): ResourceList<T> {
  const tenantId = useTenantId();
  // The client comes from MODULE SCOPE and is passed to `useQuery` explicitly, not read from
  // React context. Thirty-nine call sites mount this hook and nothing guarantees a
  // ToolkitQueryProvider above any of them — reading context would turn a missing provider into a
  // runtime throw at each one.
  const client = getToolkitQueryClient();

  const query = useQuery<T[] | null, Error>(
    {
      queryKey: resourceListKey(cacheKey, tenantId),
      queryFn: async () => {
        try {
          return await load();
        } catch (e) {
          reportUnexpectedAuthError(e, {
            feature: "resource-list",
            step: "load",
            basePath: cacheKey,
          });
          throw e;
        }
      },
      // NO retry, overriding the client's default of 1. A list read is a plain GET whose failure
      // the pane SHOWS; a silent second attempt would double every failing request across every
      // list on the platform and delay the error the user is already waiting to see.
      retry: false,
      // Outlives `staleTime` on purpose. These rows are what paints INSTANTLY on the next mount
      // while the re-read settles behind them; dropping them at the five-minute staleness
      // boundary would trade the whole point of this hook — no blank list on a click — for
      // nothing, since a stale seed still repaints and still revalidates.
      gcTime: 30 * 60 * 1000,
    },
    client,
  );

  // The documented refetch-on-identity-change contract. A NEW `load` identity means a new fetcher
  // (a filter changed), and react-query keys on `queryKey` alone — it would keep serving the
  // previous fetcher's rows forever. Invalidating on the flip re-reads with the new one.
  const loadRef = useRef(load);
  useEffect(() => {
    if (loadRef.current === load) return;
    loadRef.current = load;
    void client.invalidateQueries({
      queryKey: resourceListKey(cacheKey, tenantId),
      exact: true,
    });
  }, [load, client, cacheKey, tenantId]);

  // `refetch` is referentially stable, so `reload` is too — which is what lets callers hold it in
  // dependency arrays. ORDER GUARD: `refetch` defaults to `cancelRefetch: true`, so issuing a
  // second reload abandons the first request rather than letting it land last and revert the list.
  // The abandoned call's promise still settles for its own caller.
  const { refetch } = query;
  const reload = useCallback<ResourceList<T>["reload"]>(async () => {
    const res = await refetch();
    if (res.error) throw res.error;
  }, [refetch]);

  // An optimistic local write. Writing through the cache (rather than to component state) is what
  // makes it survive the page remount a navigation triggers.
  const setItems = useCallback<ResourceList<T>["setItems"]>(
    (next) => {
      client.setQueryData<T[] | null>(resourceListKey(cacheKey, tenantId), (prev) =>
        typeof next === "function" ? next(prev ?? null) : next,
      );
    },
    [client, cacheKey, tenantId],
  );

  const err: unknown = query.error;
  return {
    items: query.data ?? null,
    reload,
    error: err == null ? null : err instanceof Error ? err.message : "Failed to load.",
    // `isPending` covers the very first read — no data yet, so `isFetching` alone reads false for
    // the render between mounting and the fetch starting, which is the exact window a caller must
    // not mistake for "settled". `isFetching` covers every read after it.
    isFetching: query.isFetching || query.isPending,
    setItems,
  };
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
