// The profile wire shapes, transcribed from the backend rather than imported from
// `@agentic-toolkit/adh-api-types` — the convention every client in this package follows, so a
// consumer needs one dependency to talk to the API rather than two that must agree.
//
// `adh-api-types/src/data-profile-wire.test-d.ts` is what CHECKS the transcription — it measures
// every shape below against the generated types and fails `tsc` on a rename, a removal or a
// retype. The gate lives in THAT package, not next to this file, because the dependency it needs
// runs the wrong way for a portable one: `scripts/check_boundaries.py` refuses any import of the
// adh vocabulary tier from here, so the side that may depend on the other holds the file. Read
// the two together: without the gate, a backend column rename leaves every consumer compiling and
// the field reading `undefined` in the Profile editor and the public UserCard.
//
// Sources, and the operation the gate measures each against:
//   SocialLink / Address   backend `db/schema/content.ts` (socialLinksInContent /
//                          addressesInContent) — these two routes are hand-written
//                          (`routes/ownerScopedContent.ts`) but keep the generic-CRUD wire shape,
//                          which is the whole row. GET/POST `/content/social-links`,
//                          `/content/addresses`.
//   PrivacyGrant           backend `routes/privacy.ts` — a THREE-column projection, not the row.
//                          GET `/account/privacy`.
//   UsageRow               backend `lib/usage/summary.ts` `UsageSummaryRow`. GET `/usage/summary`.

// ── Owner-polymorphic profile content ─────────────────────────────────────────────────────
//
// Both tables are owned by `(ownerKind, ownerId)`, which is what lets an ORGANIZATION hold
// social links and addresses of its own. `customerId` is the denormalized CREATOR, not the
// owner — do not read it as "whose row this is".

/** Columns every owner-scoped content row carries: identity, tenancy, ownership, sync stamps. */
interface OwnerScopedRow {
  id: string;
  customerId: string;
  deletedAt: string | null;
  ecosystemId: string;
  ownerKind: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  syncVersion: number;
  syncStampedAt: string | null;
  syncTxid: number;
}

export interface SocialLink extends OwnerScopedRow {
  platform: string;
  url: string;
  handle: string;
  /** The order the PUBLIC user card renders these in — the list route sorts by it. */
  sortOrder: number;
}

/** Writable fields for create/update (the server manages id/owner/timestamps). */
export interface SocialLinkWrite {
  platform: string;
  url: string;
  handle: string;
  sortOrder?: number;
}

export interface Address extends OwnerScopedRow {
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** Writable fields for create/update. */
export interface AddressWrite {
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

// ── Privacy grants ────────────────────────────────────────────────────────────────────────

/** One row's audience, as `GET /account/privacy` projects it. */
export interface PrivacyGrant {
  targetTable: PrivacyTargetTable;
  targetId: string;
  audienceMask: number;
}

/** The `content.*` table a grant addresses. A plain string on the wire (the backend validates it
 *  against its own `CARD_TARGET` set), so this alias names the role rather than narrowing it —
 *  a client that hard-coded the members would refuse a target the backend later adds. */
export type PrivacyTargetTable = string;

/** The three audience levels the UI exposes. Mirrors PrivacyLevel from
 *  @agentic-toolkit/ui/components/privacy-level-select without coupling this module to the UI. */
export type PrivacyLevel = "only-me" | "hub" | "public";

// ── Metered usage ─────────────────────────────────────────────────────────────────────────

/** Which counter a usage row came from. Mirrors the backend's `UsageScope`; `application` is the
 *  key an APPLICATION token meters under (no page enumerates those rows yet, so a client will not
 *  see one today — but the union is the vocabulary, not the currently-reachable subset). */
export type UsageScope =
  | "user"
  | "persona"
  | "token"
  | "application"
  | "visitor"
  | "ecosystem"
  | "visitor_global";

/** Why a row is on the page. */
export type UsageRowKind = "self" | "member" | "token" | "persona" | "ecosystem";

/**
 * The caps governing a key, with `enforced` already ANDed against the global kill switch.
 *
 * WHICH of them bites depends on the key's role, not on this object: an acting key (`user`,
 * `token`, `persona`) is refused on requests/bytes, while tokens/cost bite only on the BILLING
 * keys the turn meter reserves against. So a UI must not draw a progress bar for a cap this key
 * is merely recorded against.
 */
export interface UsageLimits {
  quotaRequests: number | null;
  quotaBytes: number | null;
  quotaTokens: number | null;
  quotaCostMicros: number | null;
  /** When false the limits are RECORDED against but never refused (observe-then-enforce). */
  enforced: boolean;
}

/** One principal's traffic and spend for the current accounting window. */
export interface UsageRow {
  kind: UsageRowKind;
  scope: UsageScope;
  principalId: string;
  label: string;
  /** ISO date the current accounting window opened, from the DB clock — never the client's. */
  periodStart: string;
  periodDays: number;
  /** The tier slug governing this key, so a row that is capped differently says so. */
  tier: string;
  limits: UsageLimits;
  requests: number;
  bytes: number;
  tokens: number;
  costMicros: number;
}
