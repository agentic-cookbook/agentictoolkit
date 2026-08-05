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
import { useState, type ReactNode } from "react";

export function ToolkitQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * The QueryClient backing every `@agentic-toolkit/*` hook — reachable from HOST code.
 *
 * This is `useQueryClient` bound to the toolkit's physical react-query copy. A host cannot get
 * here on its own: importing `useQueryClient` from "@tanstack/react-query" in host code resolves
 * to the HOST's copy and reads the HOST's context, so it returns the host's client (or throws)
 * no matter how the provider tree is nested. Re-exporting the hook from inside this package is
 * the only way across, for the same module-identity reason the provider ships from here.
 *
 * Use it when a host write invalidates data a TOOLKIT panel renders — ownership transfer is the
 * archetype: the mutation is the host's, the persona list it invalidates is the toolkit's.
 * Invalidate both clients; neither one alone refreshes the whole screen.
 *
 * Must be called under <ToolkitQueryProvider>, like any react-query hook under its provider.
 */
export function useToolkitQueryClient(): QueryClientType {
  return useQueryClient();
}
