import { type SiteId } from '@agentic-toolkit/adh-registry';
export interface DetailsPageProps {
    /** The site this details page belongs to (scopes the left rail + routes). */
    siteId: SiteId;
    /** The topic to show. Omit for the site's own node (the details overview). */
    topic?: string;
}
/** The shared "topic | details" two-pane page. Server component — fully
 *  crawlable. Fed entirely by the concept module, scoped to `siteId`. The route
 *  wrapper should `notFound()` for an unknown topic before rendering.
 *
 *  Deliberately NOT built on ui's client TopicDetail: this page's rail must be
 *  real `<a>` links that render on the server, crawl, and work with JS off —
 *  requirements the interactive onSelect rail cannot meet. The visual grammar
 *  matches the suite rail via the `.adh-details__*` skin instead. */
export declare function DetailsPage({ siteId, topic }: DetailsPageProps): import("react").JSX.Element | null;
//# sourceMappingURL=DetailsPage.d.ts.map