// The Billing group's URL grammar — the ONE authoritative parse of a billing route's path
// segments into the group's selection, so the three hosts that mount BillingGroup cannot drift
// apart. Mirrors @agentic-toolkit/adh-ecosystem-panes/parse.
//
// Directive-free, and its own tsup entry (the `./parse` subpath) for the reason the preset
// describes: the barrel's dist hoists 'use client' over everything in it, so a parser re-exported
// from there would be uncallable from a host's Server Component — and nothing would complain,
// because a Client Component is legal.

/**
 * The group's members, in rail order — the settled list. It lives HERE, next to the parse, rather
 * than beside the component, because checking a URL segment against it is what a host route does
 * before rendering anything, and that route can be a server module. BillingGroup imports it back
 * for its rail, so the rail and the grammar are one list: a member added without a pane (or a pane
 * without a member) is a type error there, not a row that opens on nothing.
 */
export const BILLING_MEMBER_IDS = ["setup", "stripe", "offers", "payers", "events"] as const;
export type BillingMemberId = (typeof BILLING_MEMBER_IDS)[number];

/**
 * The members that have an INNER ENTITY, and so admit a second segment below them — an integration
 * config, an offer, a payer account. Equally a closed list, and it lives here for the same reason
 * the member list does: whether `/setup/x` is a URL is a fact about the grammar, not about a pane.
 *
 * The other two members have no inner entity at all: `setup` is a single record and `events` is a
 * flat ledger whose pane says in as many words that it ignores the sub-leaf
 * (`BillingGroup.tsx`'s `events` member). Admitting a segment under them minted unbounded distinct
 * URLs over byte-identical content — exactly what the parse below claims to prevent.
 */
export const BILLING_MEMBERS_WITH_ENTITY = ["stripe", "offers", "payers"] as const;
export type BillingMemberWithEntity = (typeof BILLING_MEMBERS_WITH_ENTITY)[number];

/** Whether a raw URL segment names one of this group's members. */
export function isBillingMemberId(id: string): id is BillingMemberId {
  return (BILLING_MEMBER_IDS as readonly string[]).includes(id);
}

/** Whether this member admits a second segment naming a record inside it. */
export function billingMemberTakesEntity(id: BillingMemberId): id is BillingMemberWithEntity {
  return (BILLING_MEMBERS_WITH_ENTITY as readonly string[]).includes(id);
}

/** Which member is open, and what is open inside it — the two segments below the host's base. */
export interface BillingPathSelection {
  memberId: BillingMemberId | null;
  entityId: string | null;
}

/**
 * Parse a billing route's catch-all `path` segments:
 *   (none) / []               → { memberId: null, entityId: null } (the group, unselected)
 *   [member]                  → that member's pane
 *   [member, entity]          → that member open on a record (an offer, a payer, an integration),
 *                               for the members that HAVE one ({@link BILLING_MEMBERS_WITH_ENTITY})
 *   anything else             → null
 *
 * NULL means "not a URL this grammar admits", and the caller's answer to that is a 404 — not this
 * same pane served at every depth. The site mounts a catch-all, so without the check
 * `/<ws>/bogus`, `/<ws>/setup/anything` and `/<ws>/offers/of_1/any/depth` would each 200 with a
 * pane identical to the one at the shorter URL, minting unbounded distinct URLs over identical
 * content and making every typo look like it worked.
 *
 * `entityId` is NOT validated, deliberately: it names an offer, a payer account or an integration
 * config, which only the server can adjudicate, and the pane shows its own not-found for an id
 * that resolves to nothing. The member id is different in kind — a fixed, closed list this package
 * owns.
 */
export function parseBillingPath(path?: string[]): BillingPathSelection | null {
  const [rawMember, entityId, ...rest] = path ?? [];
  if (rest.length > 0) return null;
  // No member segment: the group, unselected. Nothing below it to name, by construction.
  if (rawMember === undefined) return { memberId: null, entityId: null };
  if (!isBillingMemberId(rawMember)) return null;
  // A second segment is only a URL under a member that HAS an inner entity. Under `setup` or
  // `events` it names nothing, and the pane would render exactly as it does one segment up.
  if (entityId !== undefined && !billingMemberTakesEntity(rawMember)) return null;
  return { memberId: rawMember, entityId: entityId ?? null };
}
