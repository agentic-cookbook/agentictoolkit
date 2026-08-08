import { type ComponentType, type ReactElement, type ReactNode } from 'react';
import type { SiteId } from '@agentic-toolkit/adh-registry';
import type { NavLink } from '@agentic-toolkit/adh/header';
import type { FooterLink } from '@agentic-toolkit/adh/footer';
/** The serializable half of a link: what a server layout can hand across the
 *  boundary. NavLink's `icon`/function form and FooterLink's `onSelect` cannot
 *  cross it, and a site that needs either is not describing chrome any more.
 *  Derived from FooterLink so it narrows when that type does. */
type PlainLink = Pick<Extract<FooterLink, {
    href: string;
}>, 'label' | 'href'>;
export type MarketingRootHtmlProps = {
    /** Optional site-owned header nav items — the serializable subset of NavLink (this is
     *  a server component, so the function form and icon fields can't cross the boundary;
     *  matchPaths keeps active-link highlighting available to sites). */
    navLinks?: Pick<NavLink, 'label' | 'href' | 'matchPaths'>[];
    /** Optional site-owned header items rendered OUTSIDE the collapsing nav, at the bar's
     *  trailing edge — an off-site destination (`toolkit`'s GitHub) rather than a route. */
    trailingNavLinks?: PlainLink[];
    /** Optional site-owned footer links, added to the shared legal/sites row. The
     *  copyright is the brand's, not the site's, and stays owned by SiteFooter. */
    footerLinks?: PlainLink[];
    /** The marketing site this document chrome is for — drives the header brand. */
    siteId: SiteId;
    /**
     * Whether the AuthProvider runs the cross-site cold-load silent-SSO probe (default `true`,
     * the feature-site behaviour) on the site's NON-LANDING routes. The landing page (`/`) never
     * probes whatever this says — `shouldSilentRestore` refuses there — so this prop is about the
     * routes behind it. Set `false` for a FULLY PUBLIC site that must never redirect a
     * visitor on page load. The probe is a top-level `/authorize?prompt=none` navigation (the central
     * session cookie is host-only + SameSite=Lax, so it CANNOT be done silently in the background) —
     * and when the site's origin can't complete the silent bounce it strands the visitor on the
     * central login page. Turning it off keeps every route unauthenticated while the header stays
     * session-aware from local tokens (explicit Login via /auth/callback still restores the avatar);
     * the header buttons become the only auth affordance. See docs/platform/login-and-return.md.
     */
    silentSso?: boolean;
    /**
     * The site's own header, in place of the shared `<MarketingSiteHeader siteId/>`.
     *
     * This slot exists because its absence was expensive. Four sites needed a different header
     * component — community's board controls, the registry's persona search, the cookbook's
     * search/sidebar controls, the hub's app bar — and with no way to pass one, each reproduced
     * the whole `<html>`/`<head>`/`<body>`/`AuthProvider`/`AppShell` scaffold to reach the one
     * `AppShell` prop it wanted. All four then wrote `<html lang="en">` with no `dir`, silently
     * leaving the locale seam this component computes from `getLocale()`. A missing slot does not
     * keep a site on the shared shell; it just moves the whole document into the site.
     *
     * A node rather than a component type: it is rendered in the same server pass, so a site can
     * wrap its header in a `<Suspense>` boundary (the cookbook does — see its layout) without this
     * component knowing anything about it. `navLinks`/`trailingNavLinks` are the shared header's
     * props and are ignored when a site supplies its own.
     */
    header?: ReactNode;
    /**
     * The site's own context providers, mounted between the shared `AuthProvider` and `AppShell`.
     *
     * The cross-cutting providers are NOT here: `AuthProvider` is above (so a site never restates
     * the client id, the token store, or the SSO probe) and `AppShell` mounts the feature-flag,
     * help and telemetry providers below. This is only for context a site genuinely owns — the
     * cookbook's chrome coordinator, the hub's debug console / settings overlay / workspaces menu.
     *
     * A component rather than an element, because it has to WRAP `children`. It renders in the
     * same server pass, so it may be a client component (each of today's is). A site that also
     * wants a document-level node beside the shell — the cookbook's film grain — renders it here
     * as a sibling of `children`; providers emit no DOM, so the result is the same markup a
     * hand-rolled `<body>` produced.
     */
    providers?: ComponentType<{
        children: ReactNode;
    }>;
    children: ReactNode;
};
/**
 * The shared root-document shell for the ADH marketing family. Every marketing
 * site's `app/layout.tsx` was byte-identical except its `siteId` + `metadata`
 * (and all 22 `providers.tsx` were byte-identical), so the whole `<html>` …
 * `<AppShell>` scaffold lives here once:
 *  • `<html lang dir>` from the active-locale seam (`getLocale`/`htmlLang`/`localeDir`)
 *  • a `<head>` whose whole content is `<AdhThemeStyle/>` — the theme CSS variables, the
 *    appearance pre-paint script, and the font `<link>`s. The preconnects this line used to
 *    name as a second item are AdhThemeStyle's own: it derives them from the theme's font
 *    origins, so a theme that changes fonts changes them too. Nothing else belongs here;
 *    per-site `<head>` content is `metadata` in the site's own layout.
 *  • an `<AuthProvider clientId="adh" silentSso={silentSso}>` — a feature site
 *    (docs/platform/feature-sites-redesign.md) leaves the probe ON (default): the header is
 *    session-aware and `/home` is the signed-in feature surface. The probe is landing-page-exempt,
 *    hint-cookie-gated + once-per-tab (`shouldSilentRestore`) and every deployed marketing origin
 *    is in the `adh` client's `ssoReturnOrigins` allow-list — but a hint cookie makes it fire on
 *    every non-landing route the cookie is readable from, local dev included, and any origin the
 *    allow-list is missing gets stranded on the central login page. `silentSso={false}` opts the
 *    rest of a site's routes out too — no site in the family does today, and
 *    frontend/tools/verify-site-uniformity.py fails one that starts, so the escape hatch cannot
 *    be taken quietly. See the prop doc above.
 *  • `<AppShell header={header ?? <MarketingSiteHeader siteId/>} footer={…}>` — the shared
 *    chrome with the smart auth widget (avatar / Login+Sign up via SSO returnTo).
 *
 * EVERY site in the family mounts this. A site does not build its own `<html>` — a site that
 * needs something different declares it as a prop here, and if no prop fits, the prop is what
 * gets added. That rule is enforced (`frontend/tools/verify-site-uniformity.py`, check `shell`)
 * and it is not waivable by recording an exception, because the four documents that were once
 * excused are what taught us the cost: each was a copy of this file made to reach ONE slot, and
 * each silently dropped `dir` and the locale seam on the way. The per-site seams are
 * `header`, `providers`, `navLinks`, `trailingNavLinks`, `footerLinks` and `silentSso`.
 *
 * A server component: it renders the client `AuthProvider`/`SiteHeader` exactly as a
 * site layout would. Per-site `metadata` (the one genuinely per-site, SEO-bearing
 * part) and the site's `globals.css` import stay in each `app/layout.tsx`.
 *
 * Home: `@agentic-toolkit/adh/marketing` — adh VOCABULARY end to end (the ADH marketing
 * family's root document, its siteId, its clientId). It lived in the @adh-shared auth shim only
 * because that package owned the header/auth chrome it composes; Task 6.2 folded `SiteHeader`
 * into the app tier's header barrel and the toolkit took the generic halves, so the
 * circular-dependency reason for the old home is gone. The client pieces are still imported via their package
 * paths (kept external by tsup) so their 'use client' boundaries survive bundling,
 * mirroring the graph subsystem.
 */
export declare function MarketingRootHtml({ siteId, navLinks, trailingNavLinks, footerLinks, silentSso, header, providers, children, }: MarketingRootHtmlProps): ReactElement;
export {};
//# sourceMappingURL=MarketingRootHtml.d.ts.map