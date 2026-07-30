import { type ReactNode } from 'react';
/** One hierarchical level, already resolved to route hrefs by the server ({@link HelpSurface}). The
 *  client only wires the hrefs to the router — it computes no routing itself. */
export interface HelpRouteLevel {
    /** Stable {@link TopicLevel} id / react key. */
    key: string;
    title: string;
    items: {
        id: string;
        label: string;
        description?: string;
        href: string;
    }[];
    selectedId: string | null;
    /** Where re-clicking the selected row / navigating "up" from this level goes. */
    clearHref: string;
}
/**
 * The client half of the SSR help surface: renders the shared HMDV
 * ({@link HierarchicalDetailView}) over server-computed {@link HelpRouteLevel}s, translating each
 * row selection into a real route navigation (`router.push`). The detail pane (`children`) is the
 * leaf the server already rendered for the active route, so the initial paint is fully server-side;
 * this component only adds the interactive rail. It is the same HMDV the Help modal uses, so the
 * standalone site and the modal look and behave identically.
 */
export declare function HelpMasterDetail({ levels, rootLabel, children, }: {
    levels: HelpRouteLevel[];
    rootLabel: string;
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=HelpMasterDetail.d.ts.map