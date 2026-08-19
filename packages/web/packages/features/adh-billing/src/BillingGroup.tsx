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
  /** Cedes the segment BELOW the member to the host, so an offer / payer / integration is itself
   *  deep-linkable. Omit for internal selection — and note that omitting it is what the three
   *  list members' `leaf={renderSubLeaf ? subLeaf : undefined}` reads, since this prop's presence
   *  is the only honest signal of the mode (see the Stripe member below). */
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

  /**
   * The context read is still in flight. Everything but Setup reads a ROW SET through a cache key
   * built from `ecosystemId`, and while it is undefined those keys degrade to a common `billing:`
   * / `ecosystem::` bucket — one cache entry that two ecosystems visited in a single session
   * SHARE, which is exactly what keying by ecosystem exists to prevent (see OffersPane's
   * docstring). The read issued under that key is also thrown away one render later, when the id
   * arrives and the key changes.
   *
   * The RAIL is not gated on this — that is spec §2, and gating it is the dead end this design
   * exists to remove. Only the pane that would fetch waits, and only until the id lands.
   */
  const awaitingScope = !ecosystemId;
  const scopePending = <p className="p-4 text-sm text-apt-text-muted">Loading…</p>;

  // Keyed by member id and then mapped over BILLING_MEMBER_IDS, so the record is TOTAL over the
  // grammar's list and the rail's order comes from it — that list stays the one description of
  // what this group is, for the panes here and for the parse a host validates a URL against.
  const panes: Record<BillingMemberId, Omit<GroupTopicItem, "id">> = {
    setup: {
      label: "Setup",
      icon: <Settings size={16} aria-hidden />,
      // `selectMember`, not `urlSelection?.onSelect`: the optional chain is `undefined` on the two
      // hosts that mount this group with INTERNAL selection (the hub's workspace rail and the
      // products topic), so "Connect Stripe" rendered enabled there and did nothing at all. The
      // group's own setter routes to the URL when URL-driven and to internal state otherwise, so
      // the button works on all three hosts. The ternary is not defensive padding: the parameter
      // is optional so that a caller invoking `render` itself can pass one argument, and without
      // a setter the honest answer is no button rather than the inert one this replaced.
      render: (_subLeaf, selectMember) => (
        <SetupPane
          context={context}
          // Returned, not `void`-discarded. `SetupPane.toggle` AWAITS `onChanged()` and only then
          // decides what to show; `void reload()` handed it an already-resolved `undefined`, so it
          // finished against the stale context every time and the switch it had just written could
          // still read as unchanged. SetupPane owns the failure sentence for this one (see its
          // second try), which is why the promise reaches it instead of being swallowed here.
          onChanged={() => context.reload?.()}
          onOpenStripe={selectMember ? () => selectMember("stripe") : undefined}
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
      //
      // `renderSubLeaf ? subLeaf : undefined` — NOT `subLeaf` — and the same on Offers and Payers
      // below. StackGroupDetail hands a member `LOCAL_SUBLEAF` when the host cedes no deeper URL
      // segment (resource/src/group-topic-detail.tsx), and that sentinel is a TRUTHY object with a
      // constant `null` id and a no-op setter. Every one of these three panes picks its selection
      // mode by the leaf's truthiness (`leaf ? {…} : undefined`), so handing the sentinel through
      // put them in URL-driven mode pinned at "nothing selected": the rows rendered and clicking
      // one did nothing, on the hub and products mounts, forever. `undefined` is precisely the
      // state their internal-selection path exists for. Do not "simplify" this back to `subLeaf`.
      render: (subLeaf) =>
        awaitingScope ? scopePending : (
          <IntegrationsPane
            ecosystemId={ecosystemId}
            providerIds={STRIPE_ONLY}
            levelTitle="Stripe"
            leaf={renderSubLeaf ? subLeaf : undefined}
            // Setup's "Connected" / "Not connected" line and its Connect-vs-Manage button are
            // derived from `GET /billing/context`, which is read ONCE above this rail and cached at
            // the client's 5-minute staleTime. Without this, an operator could paste a valid key
            // here, save successfully, walk back to Setup and be told it is still not connected —
            // with nothing on the page able to correct it.
            //
            // Swallowed here, unlike Setup's: `IntegrationsPane`'s `onChanged?: () => void` never
            // awaits what it is handed, so a rejected reload would surface as an unhandled rejection
            // with no one to render it. The failure is not lost — `useBillingContext` reads through
            // `useResourceList`, whose default `reportErrors` files it — and the context's own
            // `isError` gate is what the operator sees.
            onChanged={() => {
              Promise.resolve(context.reload?.()).catch(() => {});
            }}
          />
        ),
    },
    offers: {
      label: "Offers",
      icon: <Tag size={16} aria-hidden />,
      leadsTo: "list",
      // `renderSubLeaf ? subLeaf : undefined` — see the Stripe member above for why.
      render: (subLeaf) =>
        awaitingScope ? scopePending : (
          <OffersPane ecosystemId={ecosystemId} leaf={renderSubLeaf ? subLeaf : undefined} />
        ),
    },
    payers: {
      label: "Payers",
      icon: <Users size={16} aria-hidden />,
      leadsTo: "list",
      // `renderSubLeaf ? subLeaf : undefined` — see the Stripe member above for why.
      render: (subLeaf) =>
        awaitingScope ? scopePending : (
          <PayersPane ecosystemId={ecosystemId} leaf={renderSubLeaf ? subLeaf : undefined} />
        ),
    },
    events: {
      label: "Events",
      icon: <Radio size={16} aria-hidden />,
      // Ignores the sub-leaf: the ledger is a flat list with one action, so there is no inner
      // entity for the segment below to name.
      render: () => (awaitingScope ? scopePending : <EventsPane ecosystemId={ecosystemId} />),
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
