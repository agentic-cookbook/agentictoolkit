"use client";

import { useQuery } from "@tanstack/react-query";
import { ecosystemsApi } from "./ecosystems";

/**
 * The WORKSPACE's default (account-infrastructure) ecosystem id — THE resolver for
 * workspace-level panes (Storage / Integrations) that scope to the ecosystem the
 * workspace's PRINCIPAL owns. Ownership-correct: resolved server-side via
 * `?workspace=<slug>&infrastructure=true` (membership-gated, exactly the workspace
 * principal's auto-provisioned own ecosystem) — never a "default/first manageable"
 * fallback, which on an org workspace silently lands on a DIFFERENT principal's
 * (the member's personal) ecosystem for reads AND writes.
 *
 * Lives here — on the ToolkitQueryProvider client, next to the API it wraps — so
 * there is ONE cache entry per slug platform-wide; hosts must consume this hook
 * rather than re-implementing the query on their own QueryClient (two caches,
 * double fetch, split invalidation).
 *
 * `ecosystemId` stays undefined while loading AND when the workspace has no
 * infrastructure ecosystem; `isError` distinguishes a failed resolution
 * (`retry: false` — one shot) so callers can show a retry surface instead of a
 * dead pane.
 */
export function useWorkspaceDefaultEcosystemId(workspaceSlug: string | undefined): {
  ecosystemId?: string;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ["workspace-default-ecosystem", workspaceSlug ?? null],
    // enabled gates on workspaceSlug != null, so the assertion can't be reached with undefined.
    queryFn: () => ecosystemsApi.workspaceDefaultEcosystemId(workspaceSlug as string),
    enabled: workspaceSlug != null,
    retry: false,
  });
  return { ecosystemId: query.data ?? undefined, isError: query.isError };
}
