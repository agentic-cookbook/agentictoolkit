import type { ReactElement } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
export interface ConceptGraphProps {
    /** Node id to open focused on. Unknown ids fall back to the root. */
    focusId: string;
    /** Small mono eyebrow above the title (a real SSR element). */
    eyebrow?: string;
    /** Plain lead of the headline (e.g. "Agentic Developer"). */
    titleLead?: string;
    /** The accented (gold, italic) site word(s) ending the headline. */
    titleAccent: string;
    /** The site this landing is for — flags the matching card "You are Here". */
    currentSiteId?: SiteId;
}
/** Server component: builds the slim graph tree (no detail prose ships to the
 *  client) and renders the interactive graph focused on `focusId`. The environment
 *  is resolved server-side from the request host so production can render a
 *  "Coming soon" state with no flash of the diagram. */
export declare function ConceptGraph({ focusId, eyebrow, titleLead, titleAccent, currentSiteId, }: ConceptGraphProps): Promise<ReactElement>;
//# sourceMappingURL=ConceptGraph.d.ts.map