"use client";

import { useCallback } from "react";
import { useQuery, type QueryKey, type PlaceholderDataFunction } from "@tanstack/react-query";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { RESOURCE_GC_TIME, getToolkitQueryClient } from "./query";
import { isNotFound } from "./http";
import { useTenantId } from "./tenant";

function resourceItemKey(cacheKey: string, tenantId: string | null, id: string): QueryKey {
  return ["resource-item", tenantId, cacheKey, id];
}

/**
 * Re-read every cached ITEM whose cache key `match` accepts, whatever its id. The mirror of
 * `revalidateResources` for {@link useResourceItemQuery}, with the same posture: a mounted reader
 * refetches immediately, an unmounted one is only marked stale, and failures are swallowed because
 * the caller is a wake signal rather than a transaction.
 *
 * It exists for the write that invalidates a read it holds no reference to — the classic being a
 * DERIVED item whose id does not change when the thing it derives from does (a per-team member
 * count keyed on the team-ID SET: adding a member changes the count and not the key, so nothing
 * about the entry looks out of date). Matching on the cache key rather than the id is the point:
 * the writer knows WHAT it invalidated, not which ids are currently cached.
 */
export function revalidateResourceItems(match: (cacheKey: string) => boolean): void {
  void getToolkitQueryClient()
    .invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === "resource-item" && typeof key[2] === "string" && match(key[2]);
      },
    })
    .catch(() => {});
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
  /** Re-read this item and update the cache. Always hits the network; a no-op when there is no
   *  id. Rejects for its own caller the way the list hook's `reload` does — a caller who only
   *  wants the failure ON SCREEN can ignore the promise and read `error`, and one who must not
   *  attribute it to whatever it just saved should say so explicitly. */
  reload: () => Promise<void>;
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
 * @param opts.reportErrors Report a failed read to the auth reporter. Default true. Pass FALSE when
 *   `load` already reports its own — the same rule, and the same reason, as
 *   {@link ResourceListOptions.reportErrors}: a fetcher that reports and then rethrows would
 *   otherwise be reported TWICE for one failure, under two contexts the dedupe cannot collapse.
 *   The fetcher wins that tie whenever it knows something this hook does not — which step failed,
 *   or that a particular status is EXPECTED and must not be reported at all (a 403 on a realm the
 *   caller simply cannot see is a fact about permissions, not an incident).
 */
export function useResourceItemQuery<T>(
  cacheKey: string,
  id: string | null,
  load: (id: string) => Promise<T>,
  opts?: { seedFrom?: () => T | undefined; absent?: boolean; reportErrors?: boolean },
): ResourceItemQuery<T> {
  const tenantId = useTenantId();
  const client = getToolkitQueryClient();
  const seedFrom = opts?.seedFrom;
  const reportErrors = opts?.reportErrors ?? true;

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
          if (reportErrors) {
            reportUnexpectedAuthError(e, {
              feature: "resource-item",
              step: "load",
              basePath: cacheKey,
            });
          }
          throw e;
        }
      },
      enabled: id != null,
      // NO retry, overriding the client's default of 1: the pane SHOWS this failure, and the
      // 404 path below has to reach the user promptly rather than after a pointless second try.
      retry: false,
      // Outlives `staleTime`, for the same reason the list's does — see {@link RESOURCE_GC_TIME},
      // which the client also pins as the default for every `resource-item` entry so the prefetch
      // and writer below, which mint entries with no observer, keep them just as long.
      gcTime: RESOURCE_GC_TIME,
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

  // `refetch` is referentially stable, so `reload` is too — which is what lets callers hold it in
  // a dependency array or hand it to a child as `onChanged`.
  const { refetch } = query;
  const reload = useCallback<ResourceItem<T>["reload"]>(async () => {
    const res = await refetch();
    if (res.error) throw res.error;
  }, [refetch]);

  const err: unknown = query.error;
  return {
    item: query.data ?? null,
    isSettled,
    isFetching: id != null && (query.isFetching || query.isPending),
    error: err == null ? null : err instanceof Error ? err.message : "Failed to load.",
    reload,
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
