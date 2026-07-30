import type { ReactNode } from 'react';
import { type DocsNavSection } from './nav';
export interface DocsShellProps {
    /** Site base path with NO trailing slash: `/docs` on the help site, `` (or `/`) on the docs site. */
    basePath: string;
    /** The active page's base-relative slug (`''` = the index), for highlighting the current row. */
    currentSlug: string;
    /** Sidebar title (e.g. the site name). */
    title?: string;
    /** The nav structure; defaults to the shared {@link DOCS_NAV}. */
    nav?: DocsNavSection[];
    /** The SSR'd page body (e.g. `<MarkdownHtml html={getDocHtml(slug)!} />`). */
    children: ReactNode;
}
/**
 * The shared ADH documentation shell: a sticky link sidebar + an article column, styled with the
 * ADH `--mdv-*` / apt tokens (no third-party docs framework). One structure for the `help` and
 * `docs` sites — each supplies its own `basePath`, so a single {@link DOCS_NAV} drives both despite
 * their different URL prefixes. Wrap it in the site's `AppShell` for the header/footer chrome.
 */
export declare function DocsShell({ basePath, currentSlug, title, nav, children }: DocsShellProps): import("react").JSX.Element;
//# sourceMappingURL=DocsShell.d.ts.map