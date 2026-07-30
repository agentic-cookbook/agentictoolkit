/** Apply a baked seed theme as the BASE by flipping its alt-block to `media="all"`
 *  (the same mechanism the old switcher used). The editor's free-form CSS then layers
 *  on top via {@link applyThemeCss}. No-op on the server / when no alt-blocks exist. */
export declare function applyBaseTheme(seedKey: string): void;
/** Apply (or replace) the live override with raw CSS. No-op on the server. */
export declare function applyThemeCss(css: string): void;
/** Remove the live override, returning the page to its persisted theme. */
export declare function clearThemeOverride(): void;
//# sourceMappingURL=theme-overrides.d.ts.map