import type { ReactElement, ReactNode } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
export type SiteWordmarkProps = {
    /** The marketing site whose brand this wordmark renders. */
    siteId: SiteId;
    /**
     * Optional identity line under the wordmark. Defaults to the site node's
     * `description`; pass `null` to omit it entirely.
     */
    tagline?: ReactNode;
    /** Extra classes on the root element. */
    className?: string;
};
/**
 * The compact brand wordmark for an ADH marketing site: the hub brand mark
 * ({@link HubMark}) beside the site's full name with its trailing accent word in
 * gold italic — the SAME lead/accent split the
 * MarketingLanding hero uses, via `splitSiteTitle` (the single source of truth for
 * the brand split) — over an optional mono identity line. Reuse this to brand a
 * marketing site's sub-pages (e.g. an author's research index) instead of
 * hand-rolling a bespoke header. Pure presentational; styled with `apt-*` tokens.
 */
export declare function SiteWordmark({ siteId, tagline, className }: SiteWordmarkProps): ReactElement;
//# sourceMappingURL=SiteWordmark.d.ts.map