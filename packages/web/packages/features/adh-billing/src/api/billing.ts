import { authedJson } from "@agentic-toolkit/auth/client";

/**
 * Every path here carries the `/api` prefix.
 *
 * `authedJson` takes a FULL path and bakes in no prefix of its own, and `/api` is
 * the Next rewrite that forwards to the backend — inside Hono the route is
 * `/billing/offers`, but nothing in the browser can reach Hono directly. A path
 * written without it resolves against the Next app itself, which has no such
 * route, so the call returns the app's 404 HTML and fails as a JSON parse error
 * naming neither billing nor the missing prefix. Checked against every sibling
 * client in the repo: all of them, in both `@agentic-toolkit/data` and the
 * feature packages' own `src/api/` directories, spell the prefix out.
 */
const BASE = "/api/billing";

export interface OfferRow {
  id: string;
  slug: string;
  name: string;
  purpose: "access" | "service" | "goods";
  stripePriceId: string;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: number | null;
  grantsEcosystemId: string | null;
  lapseAction: "none" | "read_only" | "no_access";
  graceDays: number;
  isActive: boolean;
}

export interface AccountRow {
  id: string;
  offerId: string;
  payerEmail: string | null;
  status: string;
  currentPeriodEnd: string | null;
  lapsedAt: string | null;
  claimedCustomerId: string | null;
}

/** One Stripe price, read live. Never cached — the dashboard is the source (spec §1). */
export interface PriceRow {
  id: string;
  productId: string;
  productName: string | null;
  unitAmount: number | null;
  currency: string;
  interval: string | null;
}

/** What redeeming a claim token binds the caller to. */
export interface ClaimResult {
  ok: true;
  ecosystemId: string;
  offerId: string;
}

export const listOffers = () => authedJson<OfferRow[]>(`${BASE}/offers`);
export const listAccounts = () => authedJson<AccountRow[]>(`${BASE}/accounts`);
export const listPrices = () => authedJson<PriceRow[]>(`${BASE}/prices`);

/**
 * Redeem a claim token, binding the signed-in identity to a paid account.
 *
 * Requires a session — that is the whole operation, so there is nothing to bind
 * without one, and the route's own 401 on a missing bearer is the signal that
 * sends the visitor to sign in. The caller must keep the token across that
 * round trip rather than losing it in the redirect.
 *
 * The backend answers one 404 for all four failure modes (no such token, already
 * claimed, expired, lost the race). Do not try to tell them apart in the UI:
 * distinguishing them tells a prober which tokens exist, and none of the four is
 * actionable by the claimant anyway — all four mean "ask the operator".
 */
export const claimPurchase = (token: string) =>
  authedJson<ClaimResult>(`${BASE}/claim`, {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "content-type": "application/json" },
  });
