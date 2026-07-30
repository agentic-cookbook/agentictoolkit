import type { ReactElement, ReactNode } from 'react';
/**
 * Single source of truth for the legal-page chrome shared by every site in
 * a family that renders one common legal footer. The matching styles ship
 * via `@agentic-toolkit/adh/legal.css` and are self-contained (theme vars
 * with on-brand fallbacks), so the pages render correctly on any host.
 */
export type LegalPageShellProps = {
    prefix: string;
    title: string;
    /** Rendered as "Effective <date>". Supplied by the host — the date is the
     *  host's legal fact, not the shell's. */
    effectiveDate: string;
    children: ReactNode;
};
export declare function LegalPageShell({ prefix, title, effectiveDate, children, }: LegalPageShellProps): ReactElement;
//# sourceMappingURL=LegalPageShell.d.ts.map