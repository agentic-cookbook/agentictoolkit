"use client";

import { useCallback } from "react";
import { useQuery, type QueryKey, type PlaceholderDataFunction } from "@tanstack/react-query";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { getToolkitQueryClient } from "./query";
import { isNotFound } from "./http";
import { useTenantId } from "./tenant";

function resourceItemKey(cacheKey: string, tenantId: string | null, id: string): QueryKey {
  return ["resource-item", tenantId, cacheKey, id];
}

// Mirrors react-query's own internal (unexported) `NonFunctionGuard`. Its `placeholderData` option
// wraps every generic in this conditional, and for a bare, unconstrained hook generic like this
// file's `T` the conditional stays deferred rather than reducing — so a value or function typed
// plain `T` is never assignable to it, no matter how `T` is eventually instantiated. Redeclaring
// the (one-line, stable) type lets the cast below name the field react-query actually expects,
// rather than reaching for `any`.
type NonFunctionGuard<TValue> = TValue extends Function ? never : TValue;

export interface ResourceItem<T> {
  /** The item, or null when there is nothing to show yet. May be a SEED (see `seedFrom`) until
   *  `isSettled` is true. */
  item: T | null;
  /** The server's answer for THIS id is on screen — success or failure. False while a read is in
   *  flight and while a seed is standing in for one. A pane must stay READ-ONLY until this is
   *  true: editing a seed means editing a partial item and saving over whatever the server
   *  actually has. Trivially true when there is no id to read. */
  isSettled: boolean;
  /** A read is in flight. Drive the topic list's spinner from this. */
  isFetching: boolean;
  /** The last read error, or null. */
  error: string | null;
}

export interface ResourceItemQuery<T> extends ResourceItem<T> {
  /** The item is GONE: the read 404'd, or a settled list says the id is not in it. The composed
   *  hook in `@agentic-toolkit/resource` turns this into the host's alert; nothing else should
   *  act on it directly. */
  isMissing: boolean;
}

/**
 * One cached item, painted instantly from whatever is already known and revalidated behind that
 * paint. The data half of `useResourceItem` — it knows nothing about the stack, which is what
 * keeps the query layer free of any dependency on the view that renders it.
 *
 * @param cacheKey The collection this item belongs to (the resource `basePath`).
 * @param id The item to read; null reads nothing.
 * @param load Fetch one item by id.
 * @param opts.seedFrom What is already known about this item — typically the matching list row.
 * @param opts.absent A SETTLED list says this id is not in it. The list-absence half of "gone";
 *   the 404 half is detected here. Pass `false`/omit while the list is still loading, or a pane
 *   would announce a deletion it has no evidence for.
 */
export function useResourceItemQuery<T>(
  cacheKey: string,
  id: string | null,
  load: (id: string) => Promise<T>,
  opts?: { seedFrom?: () => T | undefined; absent?: boolean },
): ResourceItemQuery<T> {
  const tenantId = useTenantId();
  const client = getToolkitQueryClient();
  const seedFrom = opts?.seedFrom;

  const query = useQuery<T, Error>(
    {
      queryKey: resourceItemKey(cacheKey, tenantId, id ?? ""),
      // Reported HERE, not at the call sites, for the same reason the list hook reports in its
      // own fetcher: a pane that hand-rolled its loader used to make this call itself, and moving
      // to the hook must not silently drop the platform's auth telemetry.
      queryFn: async () => {
        try {
          return await load(id as string);
        } catch (e) {
          reportUnexpectedAuthError(e, { feature: "resource-item", step: "load", basePath: cacheKey });
          throw e;
        }
      },
      enabled: id != null,
      // NO retry, overriding the client's default of 1: the pane SHOWS this failure, and the
      // 404 path below has to reach the user promptly rather than after a pointless second try.
      retry: false,
      // Outlives `staleTime`, for the same reason the list's does: these bytes are what paints
      // instantly on the next visit while the re-read settles behind them.
      gcTime: 30 * 60 * 1000,
      // `placeholderData`, NEVER `initialData`. A list row is a PARTIAL item; `initialData` would
      // write it into the cache as the server's answer, and every later reader would be served a
      // half item that never refetches. A placeholder paints and is discarded the moment the real
      // read lands, and it leaves nothing behind.
      //
      // Cast through `unknown` to the field's OWN declared type (`NonFunctionGuard<T>` wrapped),
      // rather than the plain `() => T | undefined` this really is — see `NonFunctionGuard` above
      // for why a direct cast can't bridge the two for an unconstrained generic `T`. Runtime
      // behaviour is unaffected; this is purely react-query's generic ceremony.
      placeholderData: seedFrom
        ? (seedFrom as unknown as PlaceholderDataFunction<
            NonFunctionGuard<T>,
            Error,
            NonFunctionGuard<T>,
            QueryKey
          >)
        : undefined,
    },
    client,
  );

  // Settled means "the answer for THIS id has landed". A placeholder is not an answer, and a
  // pending first read is not one either — both are exactly the windows a pane must not edit in.
  // An ERROR is an answer: settled is not the same as successful.
  const isSettled =
    id == null || (!query.isPending && !query.isPlaceholderData && !query.isFetching);

  const err: unknown = query.error;
  return {
    item: query.data ?? null,
    isSettled,
    isFetching: id != null && (query.isFetching || query.isPending),
    error: err == null ? null : err instanceof Error ? err.message : "Failed to load.",
    isMissing: (opts?.absent ?? false) || isNotFound(query.error),
  };
}

/**
 * Record what a mutation just learned about one item, so the cache never serves a copy the caller
 * already knows is out of date. Pass the fresh item a create/update/publish returned, or `null` for
 * one a delete removed — which EVICTS it, rather than storing a tombstone, so a later visit reads
 * the server instead of painting a document that isn't there.
 *
 * The id is an explicit parameter rather than "the open item", because the two writes that matter
 * most are about an item that is not open yet or no longer will be: a create seeds the row the
 * selection is ABOUT to move to (so its editor paints with no read at all), and a delete forgets
 * one the selection is leaving.
 *
 * Writing the response beats invalidating: the caller is holding the server's own answer, so a
 * re-read would spend a request to arrive back at the bytes already in hand.
 */
export function useResourceItemWriter<T>(cacheKey: string): (id: string, next: T | null) => void {
  const tenantId = useTenantId();
  const client = getToolkitQueryClient();
  return useCallback(
    (id: string, next: T | null) => {
      const key = resourceItemKey(cacheKey, tenantId, id);
      if (next === null) client.removeQueries({ queryKey: key, exact: true });
      else client.setQueryData<T>(key, next);
    },
    [client, cacheKey, tenantId],
  );
}

/**
 * Warm one item's cache ahead of the click that needs it. Returns a stable function; calling it
 * for an id that is already cached and fresh does nothing.
 *
 * STRICTLY WRITE-ONLY: it returns nothing and never throws. A prefetch is a guess, and a guess
 * that could surface an error — or that a caller could await — would turn hovering a row into a
 * user-visible event.
 */
export function useResourceItemPrefetch<T>(
  cacheKey: string,
  load: (id: string) => Promise<T>,
): (id: string) => void {
  const tenantId = useTenantId();
  const client = getToolkitQueryClient();
  return useCallback(
    (id: string) => {
      void client
        .prefetchQuery({
          queryKey: resourceItemKey(cacheKey, tenantId, id),
          queryFn: () => load(id),
          retry: false,
        })
        .catch(() => {});
    },
    [client, cacheKey, tenantId, load],
  );
}
