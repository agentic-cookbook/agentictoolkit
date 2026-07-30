import type { ComponentType } from 'react';
/**
 * The host's environment-override store — read and write.
 *
 * Typed STRUCTURALLY (`string | null`, not the host's env union) on purpose: adh's
 * `SiteEnv` is its four deployment tiers, which is vocabulary this package must not
 * learn. The same widening the telemetry provider used for its hostname→env resolver.
 *
 * `useEnvOverride` is a hook, so the value passed must be a stable module-level function
 * reference — it is called unconditionally on every render of the Settings panel.
 */
export interface EnvOverrideSurface {
    useEnvOverride: () => string | null;
    setEnvOverride: (env: string | null) => void;
}
/** One themeable surface inside an area — only what the console itself reads. */
export interface DebugThemeItem {
    /** Stable key in the theme's `data` map, e.g. "global.header-title". */
    id: string;
    /** Level-3 topic label. */
    label: string;
    /** Overrides the area's example for this item (e.g. a header item shows the header). */
    Preview?: ComponentType;
}
/** One theme AREA (level 2) and the items it contains (level 3). */
export interface DebugThemeArea {
    id: string;
    label: string;
    items: DebugThemeItem[];
    /** Default live example for the area's items (an item's own `Preview` wins). */
    Preview: ComponentType;
}
/**
 * The host's theme-editor taxonomy + its CSS editor.
 *
 * `readItemCss` is keyed by item ID rather than taking the item object, so the host keeps
 * its richer item type (selectors, custom properties, fallback CSS) entirely to itself —
 * this package never has to model it, and the contract stays free of the variance problem
 * a shared item type would create.
 */
export interface ThemeAreasSurface {
    areas: DebugThemeArea[];
    /**
     * Live-read the CSS currently applied to `itemId`'s target, preferring an element
     * inside `scope` (the rendered example) over the live page. Returns the item's fallback
     * block when nothing can be read.
     */
    readItemCss: (itemId: string, scope: HTMLElement | null) => string;
    /** The CSS editor to render for the selected item. */
    CssEditor: ComponentType<{
        value: string;
        onChange: (value: string) => void;
    }>;
}
//# sourceMappingURL=seams.d.ts.map