import type { ProfilePrincipal } from './types';
/**
 * A principal's public card, fetched on the SERVER for `/<slug>/profile`.
 *
 * Two requests, user then organization, because the two live in one slug namespace and only a
 * lookup can say which a handle is. It is not a new backend endpoint: an org profile costs one
 * extra round-trip on the server, where a third endpoint would cost a permanent piece of public
 * API surface — and the framework's request cache dedupes the calls `generateMetadata` and the
 * page body each make, so the pair happens once per render, not twice.
 *
 * Returns null for BOTH "no such principal" and "not visible to this request". The backend does
 * not distinguish them and neither does this.
 *
 * ALWAYS ANONYMOUS. It calls `/public/...` and carries no viewer identity, because a server
 * component in this fleet has no way to hold one: the access token lives in localStorage and the
 * only auth cookie is an opaque HttpOnly refresh cookie. That is a feature here rather than a
 * limitation — it is what keeps this response cacheable and safe to share, and it is why a `hub`
 * profile reads as null at this layer. `useViewerPrincipal` is the other half; the signed-in body
 * is fetched in the browser, from the authed twin, and never enters a server cache.
 *
 * A non-404 failure THROWS, so the route's error boundary shows an error rather than the
 * not-found page — see ProfileFallback for why that distinction is worth keeping.
 *
 * SERVER ONLY, by convention rather than by the `server-only` package, which this workspace does
 * not install (it is in no package.json here and in no lockfile, so the import would not
 * resolve; no toolkit server module uses it, including `@agentic-toolkit/auth/server`, this
 * file's closest precedent). Import it from `@agentic-toolkit/adh/profile-server`; it is
 * deliberately absent from the `./profile` barrel so a client component cannot reach it through
 * the normal import.
 *
 * The org branch NORMALIZES: `/public/orgs/:slug` answers a narrower shape than a user card
 * (no avatarUrl, none of the four granted collections) plus one field a user card lacks
 * (description). Filling those in is `principalFromOrgCard`'s job — the backend response is
 * deliberately narrow and is not this task's to widen. The normalizer lives in ./normalize
 * rather than here because the two CLIENT fetchers need exactly the same mapping.
 */
export declare function fetchPublicPrincipal(slug: string): Promise<ProfilePrincipal | null>;
//# sourceMappingURL=server.d.ts.map