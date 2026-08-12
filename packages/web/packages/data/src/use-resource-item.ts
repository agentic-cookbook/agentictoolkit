"use client";

import { useCallback, useState } from "react";
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
  /** The server's answer for THIS id is on screen — success or failure. False while the FIRST
   *  read is in flight and while a seed is standing in for one. A pane must stay READ-ONLY until
   *  this is true: editing a seed means editing a partial item and saving over whatever the server
   *  actually has. Trivially true when there is no id to read.
   *
   *  Once true for an id it STAYS true until the id changes: a background revalidation is not a
   *  reason to lock an editor the user is already typing in. Drive a spinner from `isFetching`,
   *  never from this. */
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
  /** The item is GONE: the read 404'd. The composed hook in `@agentic-toolkit/resource` turns this
   *  into the host's alert; nothing else should act on it directly.
   *
   *  A 404 and nothing else. List-absence looks like the other half of the same fact and is not:
   *  every list on this platform filters, so a row missing from the one on screen is far more often
   *  a filter than a deletion, and a pane that concluded "gone" from it would back the user out of
   *  an item that exists. */
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
  opts?: { seedFrom?: () => T | undefined; reportErrors?: boolean },
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
  //
  // STICKY per id, and it has to be. `isFetching` is true for BACKGROUND revalidations too — the
  // focus refetch react-query does by default once `staleTime` elapses, a hover prefetch of the
  // row that is already open, a live-stream wake — and every one of those happens with the
  // server's answer already on screen. Reading `isFetching` straight would UN-settle the pane each
  // time, and callers bind `readOnly`/`disabled` to this: an editor the user has had open for five
  // minutes would go dead mid-keystroke, swallowing typing with no cursor change and no message.
  // Once the answer for an id has landed it stays landed; a new id starts unsettled again.
  //
  // Latched with a render-phase setState (React's own idiom for state that must reset on a prop
  // change) rather than an effect, so the settled render is never one frame behind the answer.
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const answered =
    id != null && !query.isPending && !query.isPlaceholderData && !query.isFetching;
  if (answered && settledFor !== id) setSettledFor(id);
  const isSettled = id == null || settledFor === id;

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
    isMissing: isNotFound(query.error),
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
      const key = resourceItemKey(cacheKey, tenantId, id);
      void client
        .prefetchQuery({ queryKey: key, queryFn: () => load(id), retry: false })
        .catch(() => {})
        .then(() => {
          // Leave NOTHING behind on failure. `.catch` above only silences the promise this
          // function threw away; react-query has already written the rejection into the SHARED
          // entry, and `retry: false` means one hover is enough. The click that follows would
          // mount its pane against an entry that is already in error and paint "Failed to load"
          // before its own read had a chance — a guess turning into a user-visible event, which
          // is exactly what this hook promises not to do.
          //
          // Only when the entry is STILL in error: a real reader may have mounted and succeeded
          // in the meantime, and dropping its rows would cost the very read this was warming.
          if (client.getQueryState(key)?.status === "error") {
            client.removeQueries({ queryKey: key, exact: true });
          }
        });
    },
    [client, cacheKey, tenantId, load],
  );
}
