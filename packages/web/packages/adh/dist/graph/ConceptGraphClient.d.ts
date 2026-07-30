import { type ReactElement } from 'react';
import type { GraphNode } from '@agentic-toolkit/adh/concepts';
import { type SiteEnv, type SiteId } from '@agentic-toolkit/adh-registry';
export interface ConceptGraphClientProps {
    /** Slim graph tree (labels + structure only — no detail prose). */
    tree: GraphNode;
    /** Node the graph opens focused on (the site's node, or a `?focus=` deep-link). */
    initialFocusId: string;
    /** Small mono eyebrow above the title (the site node's kicker). */
    eyebrow?: string;
    /** Plain lead of the headline (e.g. "Agentic Developer"). */
    titleLead?: string;
    /** The accented (gold, italic) site word(s) ending the headline. */
    titleAccent: string;
    /** The site this landing is for — used to flag the matching card "You are Here". */
    currentSiteId?: SiteId;
    /** Environment (resolved server-side from the host). In `production` the diagram is
     *  replaced by a centered "Coming soon" banner. */
    env?: SiteEnv;
}
export declare function ConceptGraphClient({ tree, initialFocusId, eyebrow, titleLead, titleAccent, currentSiteId, env, }: ConceptGraphClientProps): ReactElement;
//# sourceMappingURL=ConceptGraphClient.d.ts.map