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

/** Whether a raw URL segment names one of this group's members. */
export function isBillingMemberId(id: string): id is BillingMemberId {
  return (BILLING_MEMBER_IDS as readonly string[]).includes(id);
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
 *   [member, entity]          → that member open on a record (an offer, a payer, an integration)
 *   anything else             → null
 *
 * NULL means "not a URL this grammar admits", and the caller's answer to that is a 404 — not this
 * same pane served at every depth. The site mounts a catch-all, so without the check
 * `/<ws>/bogus` and `/<ws>/offers/of_1/any/depth` would each 200 with the unselected group,
 * minting unbounded distinct URLs over identical content and making every typo look like it
 * worked.
 *
 * `entityId` is NOT validated, deliberately: it names an offer, a payer account or an integration
 * config, which only the server can adjudicate, and the pane shows its own not-found for an id
 * that resolves to nothing. The member id is different in kind — a fixed, closed list this package
 * owns.
 */
export function parseBillingPath(path?: string[]): BillingPathSelection | null {
  const [memberId, entityId, ...rest] = path ?? [];
  if (rest.length > 0) return null;
  if (memberId !== undefined && !isBillingMemberId(memberId)) return null;
  return { memberId: memberId ?? null, entityId: entityId ?? null };
}
