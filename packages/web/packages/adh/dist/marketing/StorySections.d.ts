import type { ReactElement } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
export type StorySectionsProps = {
    /** The site whose story the sections tell. */
    siteId: SiteId;
};
/**
 * The shared story sections under every marketing landing — the "thorough" half
 * of the logged-out story (the graph is the "consistent" half). Three sections,
 * all derived from data (the concept catalog, the story layer, the registry),
 * zero per-site code:
 *  • "What you can do here" — the site node's `keyPoints` (omitted until the
 *    copy pass fills them in),
 *  • the message-house pillar — the promise plus this site's pillar statement,
 *  • the next step — the story-layer `nextStep` cross-link (absolute production
 *    URL, same crawlable-interlink rationale as the footer's SEO row).
 * A server component rendering static markup: the story is crawlable in every
 * environment, including production's pre-launch state.
 */
export declare function StorySections({ siteId }: StorySectionsProps): ReactElement;
//# sourceMappingURL=StorySections.d.ts.map