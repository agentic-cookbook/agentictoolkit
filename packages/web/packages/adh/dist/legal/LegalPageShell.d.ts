import type { ReactElement, ReactNode } from 'react';
/**
 * Single source of truth for the legal-page chrome shared by every site
 * that renders the Agentic Developer Hub footer. The matching styles ship
 * via `@agentic-toolkit/adh/legal.css` and are self-contained (theme vars
 * with on-brand fallbacks), so the pages render correctly on any host.
 */
export declare const LEGAL_EFFECTIVE_DATE = "May 19, 2026";
export declare const LEGAL_CONTACT_EMAIL = "hello@agenticdeveloperhub.com";
export type LegalPageShellProps = {
    prefix: string;
    title: string;
    children: ReactNode;
};
export declare function LegalPageShell({ prefix, title, children }: LegalPageShellProps): ReactElement;
//# sourceMappingURL=LegalPageShell.d.ts.map