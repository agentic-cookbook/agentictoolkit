"use client";

import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { BillingGroup } from "@agentic-toolkit/adh-billing";
import { useBillingContext } from "@agentic-toolkit/adh-billing/context";
import { parseBillingPath, type BillingPathSelection } from "@agentic-toolkit/adh-billing/parse";
// The panes fetch through the toolkit's react-query cache, which reads the toolkit's OWN
// QueryClient context — mount its provider here (same physical module as the hooks; a
// host-provided QueryClientProvider would be a different copy and invisible to them).
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { useBasePathRoute } from "@agentic-toolkit/resource";

/**
 * The Billing feature — this site's gated product surface, and the SAME BillingGroup the hub's
 * workspace rail and agenticdeveloperproducts.com's product topic render. One rail, three hosts.
 *
 * URL grammar, rooted at the workspace:
 *   /<ws> | /<ws>/<memberId> | /<ws>/<memberId>/<entityId>
 * where memberId is setup | stripe | offers | payers | events, and <entityId> is admitted only
 * under the three members that HAVE an inner record — stripe | offers | payers. CLOSED at those
 * forms — an unknown member, a fourth segment, or an entity under `setup`/`events` (whose panes
 * have nothing for it to name) is a 404, not this same pane served at every depth (see `parse`).
 *
 * The ecosystem is NOT resolved from the workspace. Every billing route scopes by the principal's
 * ACTING ecosystem, which `useWorkspaceDefaultEcosystemId` does not answer, so the scope arrives
 * from `GET /billing/context` — see useBillingContext. A UI that guessed would flip the flag on
 * one ecosystem while every read asked about another, silently.
 *
 * A client module because a model carries functions, and functions cannot cross from a Server
 * Component into the client shell — see SiteHomeRoute.
 */
export const billingHome = defineSiteHome({
  parse: (segments) => parseBillingPath(segments) ?? notFound(),
  render: ({ scopedBase, workspaceSlug, view }) => (
    <ToolkitQueryProvider>
      <BillingHome base={scopedBase} workspaceSlug={workspaceSlug} {...view} />
    </ToolkitQueryProvider>
  ),
});

export default billingHome;

/**
 * A component rather than JSX inline in `render`, because the context read and the push helpers
 * are HOOKS, and `render` is a plain function the shell calls — not a component.
 */
function BillingHome({
  base,
  workspaceSlug,
  memberId,
  entityId,
}: {
  base: string;
  workspaceSlug: string;
} & BillingPathSelection): ReactElement {
  const context = useBillingContext(workspaceSlug);
  const { pushSegment, pushNested } = useBasePathRoute(base);
  return (
    <BillingGroup
      context={context}
      urlSelection={{ selectedId: memberId, onSelect: pushSegment }}
      renderSubLeaf={(mid) => ({
        leafId: entityId,
        onSelect: (eid) => pushNested(mid, eid),
      })}
    />
  );
}
