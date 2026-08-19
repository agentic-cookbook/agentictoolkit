import { authedJson, authedRequest } from "@agentic-toolkit/auth/client";

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

/** What the billing UI needs before it can draw a control. See routes/billing.ts's `/context`. */
export interface BillingContext {
  /** The ACTING ecosystem — the same id every other billing route scopes to, by construction.
   *  Never derive this in the browser; `useWorkspaceDefaultEcosystemId` answers a different
   *  question and the two are not guaranteed to agree. */
  ecosystemId: string;
  billingEnabled: boolean;
  canManage: boolean;
  stripeConnected: boolean;
  /** Origin-relative. Render against `window.location.origin`; adh does not register it with
   *  Stripe, the operator pastes it in. */
  webhookPath: string;
}

/**
 * One offer row, the full shape generic CRUD returns for `billing.offers`.
 *
 * Taken from the TABLE (db/schema/billing.ts:123-186), not from what a pane happened to need:
 * the previous interface omitted `description` and `stripeProductId`, so an editor built on it
 * would have silently dropped both on every save.
 */
export interface OfferRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  purpose: "access" | "service" | "goods";
  stripePriceId: string;
  stripeProductId: string | null;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: number | null;
  grantsEcosystemId: string | null;
  lapseAction: "none" | "read_only" | "no_access";
  graceDays: number;
  isActive: boolean;
}

/**
 * What a create or update body may carry: `OfferRow` minus `id`, and minus every masked column.
 *
 * The masks are not optional politeness — the factory REJECTS a body naming them. `id`,
 * `createdAt`, `updatedAt` are global SERVER_MANAGED; `ownerKind`/`ownerId` are OWNER_FROM_CREATOR,
 * stamped from the creating principal; `deletedAt` is the tombstone column. `ecosystemId` is
 * technically writable and is still not here: omitted, the factory fills it from the caller's
 * ecosystem scope, which is the only correct value — and the one value a UI could get wrong in a
 * way nothing would notice until the offer failed to sell.
 */
export type OfferBody = Omit<OfferRow, "id">;

export interface AccountRow {
  id: string;
  offerId: string;
  stripeCustomerId: string | null;
  /** For a one-off `mode: payment` purchase this is the ONLY Stripe handle the row has — an
   *  operator searching the Stripe dashboard has nothing else. */
  stripeCheckoutSessionId: string | null;
  stripeSubscriptionId: string | null;
  payerEmail: string | null;
  status: string;
  currentPeriodEnd: string | null;
  lapsedAt: string | null;
  claimedCustomerId: string | null;
  claimedAt: string | null;
  createdAt: string;
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

/** One row of the webhook ledger. `payload` is deliberately not part of this shape — see the
 *  route: it is unbounded jsonb and it is Stripe's copy rather than ours. */
export interface EventRow {
  id: string;
  stripeEventId: string;
  type: string;
  receivedAt: string;
  processedAt: string | null;
  error: string | null;
}

/** The redrive's counts, rendered verbatim. `nextOffset` is non-null only when the batch came
 *  back full, which is the one case where there may be more. */
export interface RedriveResult {
  examined: number;
  applied: number;
  terminal: number;
  stillPending: number;
  unreadable: number;
  failed: number;
  nextOffset: number | null;
}

export interface ResendClaimResult {
  ok: true;
  accountId: string;
  expiresAt: string;
}

/** What redeeming a claim token binds the caller to. */
export interface ClaimResult {
  ok: true;
  ecosystemId: string;
  offerId: string;
}

const jsonHeaders = { "content-type": "application/json" };

export const getBillingContext = () => authedJson<BillingContext>(`${BASE}/context`);

export const listOffers = () => authedJson<OfferRow[]>(`${BASE}/offers`);
export const createOffer = (body: OfferBody) =>
  authedJson<OfferRow>(`${BASE}/offers`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: jsonHeaders,
  });
// PUT, not PATCH: generic CRUD's update verb is PUT (crud/factory.ts:975).
export const updateOffer = (id: string, body: OfferBody) =>
  authedJson<OfferRow>(`${BASE}/offers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: jsonHeaders,
  });
// A DECLARED tombstone (policy.ts) — the row is soft-deleted, and its slug is freed by the
// partial unique index. Not a hard delete, whatever the verb suggests.
export const deleteOffer = (id: string) => authedRequest(`${BASE}/offers/${id}`, { method: "DELETE" });

export const listAccounts = () => authedJson<AccountRow[]>(`${BASE}/accounts`);
export const resendClaim = (accountId: string) =>
  authedJson<ResendClaimResult>(`${BASE}/accounts/${accountId}/resend-claim`, { method: "POST" });

export const listPrices = () => authedJson<PriceRow[]>(`${BASE}/prices`);

export const listEvents = (limit = 200) => authedJson<EventRow[]>(`${BASE}/events?limit=${limit}`);
export const redriveEvents = (opts?: { includeProcessed?: boolean; offset?: number }) => {
  const q = new URLSearchParams();
  if (opts?.includeProcessed) q.set("includeProcessed", "true");
  if (opts?.offset) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return authedJson<RedriveResult>(`${BASE}/events/redrive${qs ? `?${qs}` : ""}`, { method: "POST" });
};

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
