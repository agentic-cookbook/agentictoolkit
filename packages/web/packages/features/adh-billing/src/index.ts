// @agentic-toolkit/adh-billing — the Billing feature.
//
// Mounted by three hosts: the hub's workspace rail, agenticdeveloperproducts.com's product
// topic rail, and agenticdeveloperbilling.com's own workspace route. Three hosts building
// "Billing" from three copies of one pane is three features with one name.

export { BillingPanel } from "./BillingPanel";
export { claimPurchase } from "./api/billing";
export type { OfferRow, AccountRow, PriceRow, ClaimResult } from "./api/billing";
