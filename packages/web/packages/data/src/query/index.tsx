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
import { type ReactNode } from "react";

// ONE client per browser tab, at MODULE scope — not in component state.
//
// The App Router folds a dynamic segment's VALUE into its React state key, so a topic click
// (`/[workspace]/[[...path]]`) recreates the page subtree and destroys anything held in
// `useState`. Ten sites mount this provider inside that subtree, which is why the `staleTime`
// below has never once applied there: every click started with an empty cache and refetched
// everything. A module-scope client outlives the remount, which is the entire fix.
let browserClient: QueryClientType | undefined;

function makeQueryClient(): QueryClientType {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
  });
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
  return (browserClient ??= makeQueryClient());
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
