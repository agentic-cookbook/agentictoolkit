// @agentic-toolkit/adh-billing — the Billing feature.
//
// Mounted by three hosts: agenticdeveloperbilling.com's own workspace route (with URL selection),
// the hub's workspace rail and agenticdeveloperproducts.com's product topic rail (both with
// internal selection). Three hosts building "Billing" from three copies of one rail is three
// features with one name.
//
// THIS BARREL IS THE PANES, and importing anything from it costs all of them. It is one bundled
// module, so a static import of any export pulls the other four panes and — through the Stripe
// topic — `@agentic-toolkit/integrations`' pane too, no matter how the importer wrapped
// `BillingGroup` in `next/dynamic`. Everything a host needs WITHOUT mounting a pane therefore
// lives on its own subpath, and that is the rule to keep:
//
//   ./parse    the URL grammar        — a host ROUTE, which parses and 404s before a pane exists
//                                       (also the one server-safe entry; this dist is `use client`)
//   ./context  useBillingContext      — a host SHELL, deciding what to render before the rail mounts
//   ./claim    claimPurchase          — the PUBLIC `/claim` page, which shows no operator surface
//
// The types below are re-exported as types only. A `export type` is erased at build time, so it
// costs a consumer nothing at runtime — which is why they can stay here while the values cannot.

export { BillingGroup } from "./BillingGroup";
export type { BillingContextResolution } from "./useBillingContext";
export type {
  AccountRow,
  BillingContext,
  ClaimResult,
  EventRow,
  OfferBody,
  OfferRow,
  PriceRow,
  RedriveResult,
} from "./api/billing";
