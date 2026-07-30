export declare const THEME_STORAGE_KEY = "adh-theme";
export declare const ALT_STYLE_SELECTOR = "style[data-adh-theme-alt]";
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