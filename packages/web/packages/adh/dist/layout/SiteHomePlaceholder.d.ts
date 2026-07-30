import { type SiteId } from '@agentic-toolkit/adh-registry';
export type SiteHomePlaceholderProps = {
    siteId: SiteId;
    /** Optional override for the body copy. */
    blurb?: string;
};
/**
 * A themed placeholder for a site's authenticated /home, used where real home content doesn't
 * exist yet.
 *
 * The markup lives in `@agentic-toolkit/adh/layout`'s `HomePlaceholder` (this package's
 * registry-free primitive, which takes a `siteLabel` STRING). This is the adh seam: it keeps
 * the `siteId` prop its ~10 call sites already pass and resolves the label against
 * `@agentic-toolkit/adh-registry` here, so the 48-entry site registry — adh vocabulary — stays
 * out of the toolkit primitive. Consumers see no change.
 *
 * Named `SiteHomePlaceholder` rather than `HomePlaceholder`: this barrel already publishes a
 * `HomePlaceholder` (the registry-free primitive above, which this component wraps).
 */
export declare function SiteHomePlaceholder({ siteId, blurb }: SiteHomePlaceholderProps): import("react").JSX.Element;
//# sourceMappingURL=SiteHomePlaceholder.d.ts.map