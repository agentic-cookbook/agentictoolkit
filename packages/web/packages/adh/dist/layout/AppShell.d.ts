import type { ReactNode } from 'react';
import { type FooterLink } from '@agentic-toolkit/adh/footer';
export type AppShellProps = {
    /** The site header (e.g. <AdhHeader siteId=… />), supplied by the site so it
     *  can wire in its own auth/user. */
    header: ReactNode;
    children: ReactNode;
    /** Extra footer links; the copyright is a fixed brand line owned by the shared
     *  footer (not per-site). */
    footer?: {
        links?: FooterLink[];
    };
};
/**
 * The shared page shell every adh site renders: header, a flex-growing main region, and the
 * shared footer, with adh's cross-cutting providers mounted around it. Call-site signature is
 * unchanged from the pre-split husk's AppShell.
 *
 * The layout MECHANISM is `AdhAppShell` in `@agentic-toolkit/adh/layout`; this component is the
 * adh-specific composition root — which providers wrap the shell, and what goes in its footer
 * slot. Stays hook-free itself (server-renderable); the providers are client children.
 */
export declare function AppShell({ header, children, footer }: AppShellProps): import("react").JSX.Element;
//# sourceMappingURL=AppShell.d.ts.map