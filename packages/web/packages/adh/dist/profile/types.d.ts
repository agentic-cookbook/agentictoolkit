import type { UserCardDto } from '@agentic-toolkit/ui/blocks/user-card';
/**
 * A principal as a profile page sees it — a user or an organization, in the ONE shape both
 * render through.
 *
 * `UserCardDto` is already the whole public card (`slug`, `displayName`, `avatarUrl`,
 * `createdAt`, the persona roster, and the four privacy-gated collections), and an organization
 * is a card with most of those collections empty: `/public/orgs/:slug` returns identity plus a
 * persona roster, and carries no avatar and no privacy grants at all. So the org case is a
 * SUBSET of this shape, not a different one, and a union type here would force every consumer to
 * branch for a difference that only shows up as an empty array.
 *
 * `kind` exists for the one thing that genuinely differs: what to call it. "fishlamp" can be a
 * person or an organization, and a page that says the wrong one is wrong in a way no empty array
 * expresses.
 *
 * `description` is the one field that runs the other way: an org has a blurb of its own
 * (`PublicOrgProfile.description`, backend `routes/org-card.ts`) and a user has no equivalent.
 * It is optional here rather than a second union arm for the same reason as above — one shape,
 * and the single place that knows the difference is `principalFromOrgCard` in ./normalize.
 */
export type ProfilePrincipal = UserCardDto & {
    kind: 'user' | 'organization';
    description?: string | null;
};
//# sourceMappingURL=types.d.ts.map