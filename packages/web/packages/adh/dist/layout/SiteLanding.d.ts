import type { ReactNode } from 'react';
export type SiteLandingProps = {
    /** Small uppercase mono line above the title (e.g. the site's tagline). */
    eyebrow: string;
    /** Non-accented lead of the headline. Defaults to "Agentic Developer". */
    titleLead?: string;
    /** The accented (gold, italic) word(s) ending the headline. */
    titleAccent: string;
    /** Body copy under the headline. */
    blurb: ReactNode;
};
/**
 * The shared landing hero for the ADH family's sites. Renders entirely against
 * the shared theme tokens injected by <AdhThemeStyle/> (--color-*, --font-*), so
 * consumer sites need no local palette. One source of truth for all family
 * landings — see websites/scripts/scaffold-sites.py.
 *
 * The hero carries no "placeholder / coming soon" marker: the family's pre-launch
 * status is stated once, by the "Developer Preview Release" strip the shared header
 * draws above the bar, so repeating it per landing is noise.
 */
export declare function SiteLanding({ eyebrow, titleLead, titleAccent, blurb, }: SiteLandingProps): import("react").JSX.Element;
//# sourceMappingURL=SiteLanding.d.ts.map