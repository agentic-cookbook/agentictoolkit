"use client";

// The toolkit's own react-query runtime — the QueryClient(+Provider) that every
// react-query hook in @agentic-toolkit/* packages reads.
//
// WHY THE TOOLKIT OWNS THIS: react-query's context only connects a provider and
// a consumer when both import the SAME physical copy of the library. Hosts
// consume these packages via `link:` from outside their pnpm workspace, so a
// host-mounted QueryClientProvider (built from the HOST's react-query copy) is
// invisible to toolkit hooks (resolved to the TOOLKIT's copy) — `useQuery`
// throws "No QueryClient set" even though the host mounts a provider. Bundler
// dedupe can't close that gap (Turbopack resolveAlias has no server-side path
// aliasing), so react-query is instead a REGULAR dependency of the toolkit —
// an implementation detail, like any internal lib — and the provider for it
// ships from here, guaranteed to be the same physical module as the hooks.
//
// HOST CONTRACT: mount <ToolkitQueryProvider> once, above any toolkit feature
// that fetches (EcosystemsFeature, TokensPanel, the ecosystem-invitation
// hooks). It is independent of any react-query the host
// uses for its own code — separate copy, separate context, separate cache; the
// two coexist without interference.
//
// "Without interference" cuts BOTH ways, and that is the trap: a host mutation
// that invalidates its own cache does not touch this one. The host's
// `useQueryClient()` is its copy's hook reading its copy's context, so
// `invalidateQueries()` — even fully unscoped — sweeps only host-owned queries
// and silently no-ops on every toolkit query. The write lands on the server and
// the toolkit-rendered view keeps showing pre-write data, which reads as "the
// feature did nothing". `useToolkitQueryClient` below is the seam that closes
// it: a host whose write affects data a toolkit panel renders invalidates BOTH.
//
// The defaults below are the platform's single source of truth for how toolkit
// panels fetch (retry once, 5-minute staleness — not react-query's retry-3/
// stale-0), so the SAME panel behaves identically on every host.
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  type QueryClient as QueryClientType,
} from "@tanstack/react-query";
import { onSessionChange, readTokenSubject } from "@agentic-toolkit/auth/client";
import { type ReactNode } from "react";

// ONE client per browser tab, at MODULE scope — not in component state.
//
// The App Router folds a dynamic segment's VALUE into its React state key, so a topic click
// (`/[workspace]/[[...path]]`) recreates the page subtree and destroys anything held in
// `useState`. Ten sites mount this provider inside that subtree, which is why the `staleTime`
// below has never once applied there: every click started with an empty cache and refetched
// everything. A module-scope client outlives the remount, which is the entire fix.
let browserClient: QueryClientType | undefined;

/**
 * How long a resource list/item survives with no component reading it.
 *
 * Deliberately far longer than the 5-minute `staleTime` below: these bytes are what paints
 * INSTANTLY on the next visit while the re-read settles behind them, so dropping them at the
 * staleness boundary would trade the whole point of the resource hooks — no blank list on a click —
 * for nothing, since a stale seed still repaints and still revalidates.
 */
export const RESOURCE_GC_TIME = 30 * 60 * 1000;

function makeQueryClient(): QueryClientType {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  });
  // Pinned on the CLIENT, by key prefix, and not only in the two reading hooks. A cache entry's
  // gcTime is whatever its most recent observer asked for, and the resource hooks are not the only
  // things that create these entries: a prefetch (`prefetchQuery`) and a post-write
  // `setQueryData` both mint one with NO observer at all. Left to the client default those entries
  // would be collected after five minutes — so a hover-warmed item, or the row a create just
  // seeded, would be gone by the time the click that it exists for arrives. Defaults keyed on the
  // shared prefix give every writer of a `resource-*` entry the same lifetime as its readers.
  client.setQueryDefaults(["resource-list"], { gcTime: RESOURCE_GC_TIME });
  client.setQueryDefaults(["resource-item"], { gcTime: RESOURCE_GC_TIME });
  return client;
}

// The principal (`sub`) whose data the cached entries hold. Compared, never trusted for anything
// else — see `watchSession`.
let cachedFor: string | null = null;

/**
 * Empty the cache the moment the signed-in principal changes.
 *
 * The client above is at MODULE scope and survives every remount, which is the whole point — but
 * it also survives a SIGN-OUT and the next sign-in, and nothing else drops it. Cache keys don't
 * save us: the resource keys carry the tenant (`ecosystem_id`), which two users of one ecosystem
 * SHARE, and plenty of toolkit queries are keyed by nothing personal at all (`["api-tokens"]`,
 * `["workspace-members", slug]`). So on a shared machine — sign out, someone else signs in, no
 * reload — the second user is served the first's rows out of cache, instantly, with no refetch to
 * correct them: the entries are still inside the 5-minute `staleTime`, so react-query considers
 * them fresh and never asks the server. A `clear()` is the only thing that is right for ALL of
 * them at once, which is why this lives with the client rather than with any one key.
 *
 * Bound where the browser client is minted, so a client without this guard cannot exist, and so
 * nothing depends on a module-level side effect surviving `"sideEffects": false`.
 *
 * The SUBJECT and not the raw token: a refresh writes a brand-new token for the SAME user every
 * time it runs, and clearing on that would throw away the cache on a timer.
 *
 * `storage` covers the same swap performed in ANOTHER tab of this origin: it fires only in the
 * tabs that did not write, which is exactly the set that would otherwise keep serving the previous
 * account's rows.
 */
function watchSession(): void {
  cachedFor = readTokenSubject();
  const check = () => {
    const subject = readTokenSubject();
    if (subject === cachedFor) return;
    cachedFor = subject;
    browserClient?.clear();
  };
  onSessionChange(check);
  window.addEventListener("storage", check);
}

/**
 * The toolkit's query client. Callers may pass this to `useQuery`/`useMutation` explicitly rather
 * than relying on {@link ToolkitQueryProvider} being above them — which is what lets a hook used
 * at dozens of call sites cache without every one of those call sites growing a provider.
 */
export function getToolkitQueryClient(): QueryClientType {
  // Server: a FRESH client per call. A shared one would leak one request's data into another
  // request's render — the one case where module scope is exactly wrong.
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserClient) {
    browserClient = makeQueryClient();
    watchSession();
  }
  return browserClient;
}

export function ToolkitQueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getToolkitQueryClient()}>{children}</QueryClientProvider>;
}

/** The client toolkit panels fetch through. Passing the singleton explicitly means this resolves
 *  to the same client whether or not a {@link ToolkitQueryProvider} is mounted above the caller —
 *  no "No QueryClient set" throw for a panel rendered outside one. */
export function useToolkitQueryClient(): QueryClientType {
  return useQueryClient(getToolkitQueryClient());
}
