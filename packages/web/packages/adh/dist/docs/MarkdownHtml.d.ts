export interface MarkdownHtmlProps {
    /** Pre-rendered, sanitised HTML — MUST be processMarkdown output (rehype-sanitize's final step). */
    html: string;
    /** Extra class(es) appended to the always-present `adh-mv-prose`. */
    className?: string;
}
export declare function MarkdownHtml({ html, className }: MarkdownHtmlProps): import("react").JSX.Element;
//# sourceMappingURL=MarkdownHtml.d.ts.map