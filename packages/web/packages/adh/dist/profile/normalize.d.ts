import type { ProfilePrincipal } from './types';
/**
 * The two wire bodies a `ProfilePrincipal` can arrive as, and the ONE place that knows they are
 * differently shaped.
 *
 * This is a module of its own rather than a private helper inside `server.ts` because THREE call
 * sites need it, on both sides of the server/client line: `fetchPublicPrincipal` (server,
 * `/public/...`), `ProfileFallback` (client, `/api/public/...`) and `useViewerPrincipal` (client,
 * the authed twins). An earlier shape of this task normalized only in `server.ts`, which left the
 * two client fetchers spreading the raw org body into a `ProfilePrincipal` — and `UserCard` reads
 * `user.socialLinks.length`, `user.emails.length`, `user.phones.length`, `user.addresses.length`
 * and `user.personas.length` unguarded, so an organization opened from the browser would have
 * thrown on `undefined.length` rather than rendered. One normalizer, three callers.
 *
 * It is deliberately NOT re-exported from the `./profile` barrel: it is wire plumbing, and the
 * public surface of this package is the four components, the hook and the principal type.
 */
/**
 * `/public/users/:slug` and its authed twin `/users/:slug` answer the user card verbatim — the
 * whole `ProfilePrincipal` except the discriminator, which is a fact about WHICH endpoint
 * answered and never travels on the wire.
 */
export type UserCardBody = Omit<ProfilePrincipal, 'kind' | 'description'>;
/**
 * `/public/orgs/:slug` and its authed twin `/orgs/:slug` answer `PublicOrgProfile` (backend
 * `routes/org-card.ts`), which is narrower than the user card in FIVE places — no `avatarUrl`
 * and none of the four privacy-granted collections — and wider in one, `description`.
 *
 * The narrowness is deliberate on the backend and documented there twice: those four collections
 * are privacy-GRANTED sections keyed to a customer, and an org has no grants to admit, so
 * carrying them as permanently-empty arrays would advertise a gate that does not exist. That
 * argument is about the WIRE; it does not transfer to the presentation layer, where `UserCard`
 * guards every one of those sections on `.length > 0` and renders nothing for an empty array. So
 * the filling-in happens here, on the way in, and this is the one function to delete if orgs ever
 * gain those fields.
 *
 * `personas` is the field that is NOT missing — both endpoints carry a roster, and the org's
 * entries are the user's plus an `owner` stamp — so it passes straight through.
 */
export type OrgCardBody = {
    slug: string;
    displayName: string;
    description: string | null;
    createdAt: string;
    personas: ProfilePrincipal['personas'];
};
/** The user branch: the body already IS the card, so this only stamps the discriminator. */
export declare function principalFromUserCard(body: UserCardBody): ProfilePrincipal;
/** The org branch: supplies the five fields the org card does not carry, passes `description`
 *  through, and stamps the discriminator. See `OrgCardBody` for why the backend is narrow. */
export declare function principalFromOrgCard(body: OrgCardBody): ProfilePrincipal;
//# sourceMappingURL=normalize.d.ts.map