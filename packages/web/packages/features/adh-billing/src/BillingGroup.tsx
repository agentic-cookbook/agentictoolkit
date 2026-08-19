"use client";

import type { ReactElement } from "react";
import { CreditCard, Radio, Settings, Tag, Users } from "lucide-react";
import { IntegrationsPane } from "@agentic-toolkit/integrations";
import {
  RailHostBoundary,
  StackGroupDetail,
  WorkspaceNotManageable,
  WorkspaceResolutionError,
  type GroupTopicItem,
} from "@agentic-toolkit/resource";
import { BILLING_MEMBER_IDS, type BillingMemberId } from "./parse-path";
import { SetupPane } from "./SetupPane";
import { OffersPane } from "./OffersPane";
import { PayersPane } from "./PayersPane";
import { EventsPane } from "./EventsPane";
import type { BillingContextResolution } from "./useBillingContext";

/** The one provider this feature's Stripe topic is about. Module scope so the array identity is
 *  stable — `IntegrationsPane` memoizes its filter on the joined text, but a stable array costs
 *  nothing and says the list is settled. */
const STRIPE_ONLY = ["stripe"] as const;

/**
 * The Billing group — Setup / Stripe / Offers / Payers / Events — as a nested topic▸detail rail.
 *
 * The SAME five members appear in three places, which is why they live here rather than in any
 * host: agenticdeveloperbilling.com's workspace route, the hub's workspace rail, and
 * agenticdeveloperproducts.com's product topic. A copy per host is three copies of one rail, and
 * nothing makes them agree.
 *
 * Modelled on StorageGroup, not on ResourceExplorer's `promoteTopics`. That mode looks like a fit
 * and routes as `<basePath>/<scopedId>/<topic>/<leaf>` — the ecosystem uuid lands in every URL.
 * Billing has one scope per workspace and the workspace segment already names it, so the id would
 * be unstable noise in every link.
 *
 * Setup and Stripe are separate rows rather than one pane with three cards, because Stripe is
 * delegated WHOLE: `IntegrationsPane` publishes its own master/detail level and renders its own
 * detail column. A pane that both drew cards and hosted a delegated rail would stack a detail form
 * under two unrelated cards.
 *
 * The group opens UNSELECTED — selecting an item never auto-selects a topic (StackGroupDetail's
 * own rule).
 *
 * Self-hosting: it wraps its rail in RailHostBoundary, so it draws one under the hub's chrome and
 * on a bare feature site alike.
 */
export function BillingGroup({
  context,
  urlSelection,
  renderSubLeaf,
}: {
  /**
   * The injected resolution of `GET /billing/context`.
   *
   * Injected rather than resolved here because the three hosts fetch it from three places, while
   * the GATE below — what each outcome shows — must be one decision, not three. Same rule
   * StorageGroup's `EcosystemScopeResolution` follows.
   */
  context: BillingContextResolution;
  /** Omit for internal selection (the hub and products embeds) — StackGroupDetail's fallback. */
  urlSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  renderSubLeaf?: (memberId: string) => { leafId: string | null; onSelect: (id: string | null) => void };
}): ReactElement {
  const { ecosystemId, canManage, isError } = context;
  if (isError) return <WorkspaceResolutionError />;
  // A viewer can reach this ecosystem but not manage its billing — every read and write below
  // would 403 per-pane, so show the honest notice instead. Gated on a RESOLVED context: while
  // `ecosystemId` is undefined the read is still in flight and `canManage` defaults false, which
  // would flash this notice at an owner on every mount.
  if (ecosystemId && !canManage) return <WorkspaceNotManageable feature="Billing" />;
  // NOT gated: `billingEnabled === false`. Turning it on is the first thing Setup is for, and a
  // gate here is the dead end that produced the screenshot this design exists to remove.

  // Keyed by member id and then mapped over BILLING_MEMBER_IDS, so the record is TOTAL over the
  // grammar's list and the rail's order comes from it — that list stays the one description of
  // what this group is, for the panes here and for the parse a host validates a URL against.
  const panes: Record<BillingMemberId, Omit<GroupTopicItem, "id">> = {
    setup: {
      label: "Setup",
      icon: <Settings size={16} aria-hidden />,
      render: () => (
        <SetupPane
          context={context}
          onChanged={() => void context.reload?.()}
          onOpenStripe={() => urlSelection?.onSelect("stripe")}
        />
      ),
    },
    stripe: {
      label: "Stripe",
      icon: <CreditCard size={16} aria-hidden />,
      // The ENTIRE billing-side implementation of "let me connect stripe". Billing owns no
      // credential code, no secret field, no validation call and no second store — it mounts the
      // same component the Integrations site mounts, filtered to one provider. Setting Stripe up
      // here and setting it up under Integrations write the same provider_config row through the
      // same routes, which is what makes drift impossible rather than unlikely.
      render: (subLeaf) => (
        <IntegrationsPane
          ecosystemId={ecosystemId}
          providerIds={STRIPE_ONLY}
          levelTitle="Stripe"
          leaf={subLeaf}
        />
      ),
    },
    offers: {
      label: "Offers",
      icon: <Tag size={16} aria-hidden />,
      leadsTo: "list",
      render: (subLeaf) => <OffersPane ecosystemId={ecosystemId} leaf={subLeaf} />,
    },
    payers: {
      label: "Payers",
      icon: <Users size={16} aria-hidden />,
      leadsTo: "list",
      render: (subLeaf) => <PayersPane ecosystemId={ecosystemId} leaf={subLeaf} />,
    },
    events: {
      label: "Events",
      icon: <Radio size={16} aria-hidden />,
      // Ignores the sub-leaf: the ledger is a flat list with one action, so there is no inner
      // entity for the segment below to name.
      render: () => <EventsPane ecosystemId={ecosystemId} />,
    },
  };
  const items: GroupTopicItem[] = BILLING_MEMBER_IDS.map((id) => ({ id, ...panes[id] }));

  // StackGroupDetail PUBLISHES its rail rather than drawing one — a mount with no rail host above
  // it renders only the leaf's select hint, which is not an error and not an empty list but a
  // surface with nothing on it. The hub supplies a host and this boundary passes straight through
  // there; the billing site has no chrome of its own, so the boundary becomes the host. It lives
  // HERE, on the component a site mounts, because a host each site had to remember to add is a
  // host a site can forget, and forgetting it costs the whole rail with nothing to say so.
  return (
    <RailHostBoundary>
      <StackGroupDetail
        levelId="billing-group"
        title="Billing"
        items={items}
        urlSelection={urlSelection}
        renderSubLeaf={renderSubLeaf}
      />
    </RailHostBoundary>
  );
}
