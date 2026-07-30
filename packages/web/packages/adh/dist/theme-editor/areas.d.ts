import type { ComponentType } from 'react';
export interface ThemeItem {
    /** Stable key in the theme's `data` map, e.g. "global.header-title". */
    id: string;
    /** Level-3 topic label. */
    label: string;
    /** The CSS selector this item targets / scaffolds. */
    selector: string;
    /** Regular CSS properties to read from the element matching `selector`. */
    props?: string[];
    /** `:root` custom properties to read (fonts, colors, the type scale, …). */
    vars?: string[];
    /** Fallback block when nothing can be read live (e.g. a pseudo-element / closed menu). */
    defaultCss?: string;
    /** Override the area's example for this item (e.g. a header element shows the header). */
    Preview?: ComponentType;
    hint?: string;
}
export interface ThemeArea {
    id: string;
    label: string;
    items: ThemeItem[];
    /** Default example for the area's items (an item's own `Preview` wins). */
    Preview: ComponentType;
}
export declare const THEME_AREAS: ThemeArea[];
/** Build the "current css" for an item — read LIVE so it reflects the selected theme.
 *  `:root` vars come from the document element; component props from the first element
 *  matching the selector, PREFERRING `scope` (the rendered example container) so the
 *  css shown matches the example. Falls back to `defaultCss` (or a bare rule) when
 *  nothing is readable — e.g. a pseudo-element or a closed menu. */
export declare function readItemCss(item: ThemeItem, scope?: ParentNode | null): string;
//# sourceMappingURL=areas.d.ts.map