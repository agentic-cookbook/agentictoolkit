import { type SiteId } from '@agentic-toolkit/adh-registry';
export interface LandingGraphProps {
    /** The marketing site whose node the landing graph opens focused on. */
    siteId: SiteId;
    /** Optional `?focus=` override from the page's searchParams (deep-link). */
    focusId?: string;
}
/** A site's landing graph: the shared concept graph, opened focused on this
 *  site's node (or a `?focus=` deep-link). Server component. */
export declare function LandingGraph({ siteId, focusId }: LandingGraphProps): import("react").JSX.Element;
//# sourceMappingURL=LandingGraph.d.ts.map