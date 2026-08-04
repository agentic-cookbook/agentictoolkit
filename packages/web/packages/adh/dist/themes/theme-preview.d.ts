export declare const THEME_STORAGE_KEY = "adh-theme";
export declare const ALT_STYLE_SELECTOR = "style[data-adh-theme-alt]";
/** Activate a baked theme by flipping its alt-block to `media="all"` and every other
 *  block back to `media="not all"` — the whole of what "switching theme" means at
 *  runtime. No-op on the server / in production, where no alt-blocks are emitted.
 *
 *  Lives beside {@link themePrePaintScript}, which does this same flip in string form
 *  before hydration, and beside ALT_STYLE_SELECTOR, which names the nodes both touch:
 *  the pre-paint's mirror of this logic is only safe while the thing being mirrored is
 *  in the same file. Callers that also want the choice REMEMBERED pair it with
 *  {@link persistTheme}; the theme editor deliberately does not (its live override is
 *  in-session), which is why the two stay separate functions. */
export declare function applyBaseTheme(seedKey: string): void;
export declare function cookieDomain(): string;
export declare function readStoredTheme(): string | null;
export declare function persistTheme(id: string): void;
/** The previewed theme to carry across a cross-site hop — null in production / SSR
 *  (no alt-theme blocks present) so callers stay inert there. */
export declare function readPreviewTheme(): string | null;
/** Tag a CROSS-SITE destination href with the previewed theme as a `#adh-theme=…`
 *  fragment so the target applies it on arrival. No-op for non-http (same-origin)
 *  hrefs; preserves a destination's own fragment; refreshes a stale adh-theme one. */
export declare function appendThemePreview(href: string, theme: string | null): string;
export declare function themePrePaintScript(): string;
//# sourceMappingURL=theme-preview.d.ts.map