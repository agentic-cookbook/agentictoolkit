// @agentic-toolkit/adh-billing — the Billing feature.
//
// Mounted by three hosts: agenticdeveloperbilling.com's own workspace route (with URL selection),
// the hub's workspace rail and agenticdeveloperproducts.com's product topic rail (both with
// internal selection). Three hosts building "Billing" from three copies of one rail is three
// features with one name.
//
// The URL grammar is NOT re-exported here: this barrel's dist is a "use client" module, so a host
// route importing the parser from it would throw in prod. It lives at ./parse.

export { BillingGroup } from "./BillingGroup";
export { useBillingContext, BILLING_CONTEXT_CACHE_KEY, type BillingContextResolution } from "./useBillingContext";
export { claimPurchase } from "./api/billing";
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
