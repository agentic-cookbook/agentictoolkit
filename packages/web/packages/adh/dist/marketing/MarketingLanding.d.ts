import type { ReactElement } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
export type MarketingLandingProps = {
    /** The marketing site whose copy this landing renders. */
    siteId: SiteId;
    /** Optional `?focus=` deep-link forwarded to the landing graph (no effect on
     *  the production hero). */
    focusId?: string;
};
/**
 * The shared logged-out landing for the ADH marketing family: the concept-graph
 * explorer opened focused on this site's node (the "consistent" half — every
 * site shows the same map of the constellation, centred on itself), followed by
 * the shared {@link StorySections} (the "thorough" half — key points, the
 * message-house pillar, the next step). Everything derives from `siteId` — zero
 * hard-coded copy — via the registry, the story layer (sites/story.ts), and the
 * site-config content catalog behind the locale seam.
 *
 * The diagram is doubly gated: production never constructs it (the family's
 * pre-launch gate — prod pages stay static), and in the pre-launch envs it
 * only mounts when the `landing_site_explorer_diagram` feature flag is on
 * (default off — the static `SiteLanding` hero shows instead). The story
 * sections render in every environment. A server component: the whole story
 * is crawlable server markup.
 */
export declare function MarketingLanding({ siteId, focusId }: MarketingLandingProps): ReactElement;
//# sourceMappingURL=MarketingLanding.d.ts.map