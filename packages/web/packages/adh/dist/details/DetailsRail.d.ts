export interface RailTopic {
    id: string;
    label: string;
    href: string;
    active: boolean;
    leaf: boolean;
}
/** The details-page topic rail: a substring title filter on top, then the topic
 *  links. Arrow keys move focus through the (filtered) list; Enter follows the
 *  focused link natively (the links stay real <a>s, so the rail is crawlable and
 *  works with JS off). A client island — its own chunk via a dedicated package
 *  subpath, the same boundary trick as graph/ConceptGraphClient. */
export declare function DetailsRail({ topics, siteLabel }: {
    topics: RailTopic[];
    siteLabel: string;
}): import("react").JSX.Element;
//# sourceMappingURL=DetailsRail.d.ts.map