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
// The defaults below are the platform's single source of truth for how toolkit
// panels fetch (retry once, 5-minute staleness — not react-query's retry-3/
// stale-0), so the SAME panel behaves identically on every host.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
