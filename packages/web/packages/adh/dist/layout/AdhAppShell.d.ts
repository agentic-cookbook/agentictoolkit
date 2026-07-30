import type { ReactNode } from 'react';
export type AdhAppShellProps = {
    /** The site header (e.g. adh's <SiteHeader siteId=… />), supplied by the host so it can
     *  wire in its own auth/user. */
    header: ReactNode;
    children: ReactNode;
    /** Already-rendered footer. A ReactNode, not a `{ links }` bag: this package cannot know
     *  what a host's footer link looks like. `@agentic-toolkit/adh/layout` keeps the object form its
     *  call sites use and renders <AdhFooter/> into this slot. */
    footer?: ReactNode;
    /** Mount the dev-only switches (the 10x animation scale and the HTDV layout log).
     *
     *  A PROP, not a build-time const read off `process.env.NEXT_PUBLIC_DEPLOYMENT_ENV` as it
     *  was in the pre-split shell: a toolkit package cannot depend on one host's env var.
     *
     *  KNOW THE COST. The pre-split shell read that env var here, so a production build
     *  dead-code-eliminated the two switch components entirely. It cannot any more: this entry
     *  imports them unconditionally, and the value the host folds to `false` at build time is a
     *  runtime prop by the time it crosses the package boundary — no bundler can propagate it
     *  back through the import. So `DevAnimScale` and `HtdvLayoutLogSwitch` (and the
     *  `@agentic-toolkit/ui/blocks` code they pull in) now SHIP IN EVERY PRODUCTION CLIENT
     *  BUNDLE and are gated at RUNTIME instead. That is the accepted price of the
     *  mechanism/vocabulary seam; re-reading a host env var here to win the bytes back would
     *  put one host's deployment vocabulary inside a generic package, which is the exact thing
     *  this split exists to prevent. The components are render-free and inert while the prop is
     *  false, so the cost is bytes, not behaviour.
     *
     *  Defaults to `false` so a host that says nothing gets no dev tools. */
    devTools?: boolean;
};
/**
 * The page shell an adh-style site renders: header, a flex-growing main region, and a footer
 * slot. Keeps the basic layout identical across sites.
 *
 * MECHANISM ONLY. Which providers wrap this (feature flags, help, telemetry) and which footer
 * goes in the slot are the host's business — see `@agentic-toolkit/adh/layout`'s `AppShell`, which is
 * the pre-split component's exact call-site signature.
 *
 * Hook-free itself, so it is server-renderable in principle; in a built bundle the `layout`
 * entry carries a hoisted 'use client' from the leaves it inlines (AppErrorBoundary and the
 * dev switches), which is what the pre-split `@adh-shared/adh/layout` (this package's former
 * name) did too.
 */
export declare function AdhAppShell({ header, children, footer, devTools }: AdhAppShellProps): import("react").JSX.Element;
//# sourceMappingURL=AdhAppShell.d.ts.map