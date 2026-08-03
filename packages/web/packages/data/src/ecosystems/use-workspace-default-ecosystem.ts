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
 * dead pane, and `isPending` separates the two undefined cases for the callers
 * that must not act on "no infrastructure ecosystem" until it is actually the answer.
 */
export function useWorkspaceDefaultEcosystemId(workspaceSlug: string | undefined): {
  ecosystemId?: string;
  /** True unless the caller can only VIEW (not manage) the workspace's infrastructure ecosystem
   *  — a plain org member. Defaults to true while loading / when there is no infra row, so a
   *  host only gates when the resolution definitively says the caller can't manage. */
  canManage: boolean;
  isError: boolean;
  /** No answer yet — the query is loading (or disabled, with no `workspaceSlug` to resolve).
   *  Distinct from a resolved `ecosystemId: undefined`, which is the definitive "this workspace
   *  has no infrastructure ecosystem". A caller that PREVIEWS something derived from the id
   *  (an address prefix) must show nothing while this is true rather than the no-parent shape,
   *  which is a different, wrong answer. */
  isPending: boolean;
} {
  const query = useQuery({
    queryKey: ["workspace-default-ecosystem", workspaceSlug ?? null],
    // enabled gates on workspaceSlug != null, so the assertion can't be reached with undefined.
    queryFn: () => ecosystemsApi.workspaceDefaultEcosystemId(workspaceSlug as string),
    enabled: workspaceSlug != null,
    retry: false,
  });
  return {
    ecosystemId: query.data?.id ?? undefined,
    canManage: query.data?.canManage ?? true,
    isError: query.isError,
    // `isPending` (not `isLoading`) so a DISABLED query — no workspaceSlug — also reads as
    // "no answer", which is exactly what it is: react-query leaves a disabled query in the
    // pending status forever, and it has resolved nothing.
    isPending: query.isPending,
  };
}
