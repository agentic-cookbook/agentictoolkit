import type { ReactElement, ReactNode } from 'react';
/**
 * The family's gate for `/<workspace>`: the workspace for a caller who can reach it, that
 * principal's PROFILE for one who cannot.
 *
 * It replaces `HomeGate` on this mount, and the difference is the whole feature. HomeGate sends
 * an unauthenticated visitor out through the cross-site SSO flow — correct for `/home`, which is
 * an app, and wrong for `/<slug>`, which is a person's address. A visitor who follows a link to
 * `agenticdeveloperprojects.com/mikefullerton` is not trying to sign in; they are trying to look
 * at Mike.
 *
 * Signed in, this renders `children` and defers to `SiteHomeShell`, which makes the narrower
 * judgement — the caller is authenticated but is not a MEMBER of this workspace — and lands in
 * the same place. Two checks rather than one because they are answerable at different times: a
 * session is known immediately, membership only after the workspace list resolves.
 */
export declare function WorkspaceOrProfileGate({ children }: {
    children: ReactNode;
}): ReactElement | null;
//# sourceMappingURL=WorkspaceOrProfileGate.d.ts.map