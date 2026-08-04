import type { ReactElement } from 'react';
import type { SiteId } from '@agentic-toolkit/adh-registry';
import type { NavLink } from '@agentic-toolkit/adh/header';
export type MarketingSiteHeaderProps = {
    /** The marketing site this header is for — drives the header brand. */
    siteId: SiteId;
    /** Optional site-owned nav items (static + serializable — this crosses the
     *  server→client boundary from a site's layout via MarketingRootHtml). */
    navLinks?: NavLink[];
};
/**
 * The session-aware header for the marketing/feature-site family — SiteHeader
 * bound to the shared smart source (`makeSmartHeaderAuth`, the personaregistry
 * pattern): the avatar shows when signed in, Login/Sign up run the central SSO
 * flow with the shared home-or-root returnTo, and site switches ride the
 * silent-SSO bounce. See docs/platform/feature-sites-redesign.md.
 *
 * Exists as its own client component because {@link MarketingRootHtml} is a
 * server component: a hook prop (`useAuthSource`) can't cross the server→client
 * boundary, so the source is bound here, on the client side of it.
 *
 * Home: `@agentic-toolkit/adh/marketing` — adh VOCABULARY end to end (the ADH marketing family's
 * header, bound to adh's `clientId`). It is its OWN export subpath, not just a member of
 * the `marketing` barrel: this module is `'use client'` while its barrel-mates
 * (MarketingRootHtml, MarketingLanding, StorySections) are server components, and under
 * `bundle: true, splitting: false` an inlined `'use client'` leaf hoists its directive over
 * the WHOLE entry file. Same boundary trick as marketing/LandingHeroGate.
 */
export declare function MarketingSiteHeader({ siteId, navLinks }: MarketingSiteHeaderProps): ReactElement;
//# sourceMappingURL=MarketingSiteHeader.d.ts.map