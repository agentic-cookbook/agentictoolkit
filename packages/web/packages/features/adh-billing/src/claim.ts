"use client";

// `@agentic-toolkit/adh-billing/claim` — the buyer's side of billing, and nothing else.
//
// Its consumer is a PUBLIC page: `/claim?token=…`, which a person opens straight out of a
// purchase email, usually before they have ever seen the operator surfaces. Reaching
// `claimPurchase` through the main barrel would put all five operator panes — and, through the
// Stripe topic, the whole integrations pane — in that page's chunk, because the barrel is one
// bundled module and a static import of any of its exports pulls the rest.
//
// Same reasoning as ./context and ./parse: the barrel is the PANES, and anything a host needs
// without mounting a pane gets its own entry.

export { claimPurchase } from "./api/billing";
export type { ClaimResult } from "./api/billing";
