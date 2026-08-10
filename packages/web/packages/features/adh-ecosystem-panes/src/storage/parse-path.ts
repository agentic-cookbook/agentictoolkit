// The Storage group's URL grammar — the ONE authoritative parse of a storage route's path
// segments into the group's selection, so the two hosts that mount StorageGroup under a
// catch-all cannot drift apart: the hub's `/<slug>/storage/[[...path]]` and
// agenticdeveloperstorage.com's `/[workspace]/[[...path]]` are the SAME three members at the
// same two depths. Mirrors @agentic-toolkit/ecosystems/parse.
//
// Directive-free, and its own tsup entry (the `./parse` subpath) for the reason the preset
// describes: the barrel's dist hoists 'use client' over everything in it, which would make this
// uncallable from a host's Server Component page — and the hub's page is exactly that.

/**
 * The group's members, in rail order — the settled list. It lives HERE, next to the parse, rather
 * than beside the component, because checking a URL segment against it is what a host route does
 * before rendering anything, and that route can be a server module. StorageGroup imports it back
 * for its rail, so the rail and the grammar are one list: a member added without a pane (or a pane
 * without a member) is a type error there, not a row that opens on nothing.
 */
export const STORAGE_MEMBER_IDS = ["buckets", "access", "all-data"] as const;
export type StorageMemberId = (typeof STORAGE_MEMBER_IDS)[number];

/** Whether a raw URL segment names one of this group's members. */
export function isStorageMemberId(id: string): id is StorageMemberId {
  return (STORAGE_MEMBER_IDS as readonly string[]).includes(id);
}

/** Which member is open, and what is open inside it — the two segments below the host's base. */
export interface StoragePathSelection {
  memberId: StorageMemberId | null;
  entityId: string | null;
}

/**
 * Parse a storage route's catch-all `path` segments:
 *   (none) / []               → { memberId: null, entityId: null } (the group, unselected)
 *   [member]                  → that member's pane
 *   [member, entity]          → that member open on an entity (e.g. a bucket)
 *   anything else             → null
 *
 * NULL means "not a URL this grammar admits", and the caller's answer to that is a 404 — not this
 * same pane served at every depth. Both hosts mount a catch-all, so without the check
 * `/<base>/bogus` and `/<base>/buckets/b_1/any/depth/at/all` would each 200 with the unselected
 * group, minting unbounded distinct URLs over identical content and making every typo look like it
 * worked.
 *
 * `entityId` is NOT validated, deliberately: it names a bucket or an access grant, which only the
 * server can adjudicate, and the pane shows its own not-found for an id that resolves to nothing.
 * The member id is different in kind — it is a fixed, closed list this package owns.
 */
export function parseStoragePath(path?: string[]): StoragePathSelection | null {
  const [memberId, entityId, ...rest] = path ?? [];
  if (rest.length > 0) return null;
  if (memberId !== undefined && !isStorageMemberId(memberId)) return null;
  return { memberId: memberId ?? null, entityId: entityId ?? null };
}
