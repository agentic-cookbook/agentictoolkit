/**
 * @agentic-toolkit/adh/docs — the ADH-native documentation shell.
 *
 * A server-rendered sidebar + article layout (no third-party docs framework), driven by the shared
 * {@link DOCS_NAV}. Feed it the pre-rendered HTML for a slug via {@link getDocHtml} + {@link MarkdownHtml}:
 *
 *   <AppShell header={…}>
 *     <DocsShell basePath="/docs" currentSlug={slug} title="Help">
 *       <MarkdownHtml html={getDocHtml(slug)!} />
 *     </DocsShell>
 *   </AppShell>
 *
 * Import the CSS once per app: `import '@agentic-toolkit/adh/docs.css'`.
 */
export { DocsShell } from './DocsShell';
export type { DocsShellProps } from './DocsShell';
export { DOCS_NAV, docsHref, docsSlugs, docsNavLabel } from './nav';
export type { DocsNavLink, DocsNavSection } from './nav';
export { getDocHtml, getDocHtmlByKey, docContentKey } from './content';
export { MarkdownHtml } from './MarkdownHtml';
export type { MarkdownHtmlProps } from './MarkdownHtml';
//# sourceMappingURL=index.d.ts.map