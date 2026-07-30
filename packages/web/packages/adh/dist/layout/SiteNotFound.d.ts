import { type ReactNode } from 'react';
export type SiteNotFoundProps = {
    /** The URL-fragment marker a site-switch navigation carries, e.g. `#site-switch`. Injected
     *  rather than imported: the constant is adh VOCABULARY living in
     *  `@agentic-toolkit/adh-registry`. This package does declare that sibling now — the prop is
     *  a DESIGN choice, not a boundary the build enforces: it keeps this 404 body a registry-free
     *  primitive a non-adh host can render. `@agentic-toolkit/adh/layout`'s AppShell wraps it and
     *  passes `SITE_SWITCH_HASH`, so adh call sites keep their current props. */
    siteSwitchHash: string;
    /** The normal 404 UI to show when this isn't a site-switch up-walk. */
    children?: ReactNode;
};
/**
 * Shared `not-found` body. When a navigation came from the site-switcher (the
 * URL carries the site-switch hash) and the exact route doesn't exist here,
 * walk the path up one segment at a time until a real route resolves —
 * `…/home/foo` → `…/home` → `/`. Normal 404s (no marker) render as-is.
 * Cross-origin-safe: each site resolves its own routes; no knowledge of others.
 */
export declare function SiteNotFound({ siteSwitchHash, children }: SiteNotFoundProps): import("react").JSX.Element;
//# sourceMappingURL=SiteNotFound.d.ts.map