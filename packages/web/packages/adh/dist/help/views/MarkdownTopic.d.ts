/**
 * Renders a markdown help topic in the modal's detail pane. `contentKey` indexes the generated
 * {@link HELP_CONTENT_HTML} map (PRE-RENDERED HTML built from `content/*.md` by
 * `tools/gen-help-content.py`), which {@link MarkdownHtml} injects as-is — no runtime markdown
 * processing, so the pane paints instantly with no "Rendering…" flash. The docs sites render the
 * exact same HTML server-side, so a topic looks identical in the modal and on its page.
 *
 * The shared content's cross-links are site-relative help paths (`/quickstart`, `/reference/errors`,
 * `/rest-api`, `/quickstart/oauth/overview`, …) — correct on the help site, but dead in the modal,
 * which is mounted on every site (none of which have those routes). So here we intercept clicks on
 * links whose path is a known help topic slug and navigate the modal's OWN topic tree instead,
 * keeping the reader in the modal rather than off-siting them into a 404. External links, anchors,
 * and links with no matching topic (or modified/new-tab clicks) are left to behave normally.
 */
export declare function MarkdownTopic({ contentKey }: {
    contentKey: string;
}): import("react").JSX.Element;
//# sourceMappingURL=MarkdownTopic.d.ts.map