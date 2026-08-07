import type { ReactElement, ReactNode } from 'react'
import { AdhThemeStyle } from '@agentic-toolkit/adh/server'
// Package paths, never relative ones, for every cross-directory specifier below — even
// though `layout`, `concepts` and `marketing/MarketingSiteHeader` are now siblings in THIS
// package. Each is its own tsup entry with a matching `external`, because each holds
// module-level state (AppShell mounts FeatureFlagsProvider/HelpProvider/TelemetryProvider —
// React contexts plus a one-shot SDK init; the concepts barrel holds the taxonomy's `byId`
// map) or, for MarketingSiteHeader, a `'use client'` directive that inlining would hoist over
// this whole server entry. A relative specifier would inline a private copy and silently fork
// that state. Both halves of the remedy are required — see the note atop layout/AppShell.tsx
// and frontend/tools/verify-bundle-boundaries.py.
import { AppShell } from '@agentic-toolkit/adh/layout'
import { getLocale, htmlLang, localeDir } from '@agentic-toolkit/adh/concepts'
import type { SiteId } from '@agentic-toolkit/adh-registry'
import { AuthProvider } from '@agentic-toolkit/adh/auth'
import { MarketingSiteHeader } from '@agentic-toolkit/adh/marketing/MarketingSiteHeader'
// The generic header type, from the merged header barrel — the same one SiteHeader comes
// from. It used to ride in on the retired @adh-shared auth shim, which re-exported it from
// the SiteHeader that Task 6.2 folded into the app tier's own header barrel; both barrels
// are this one now.
import type { NavLink } from '@agentic-toolkit/adh/header'
import type { FooterLink } from '@agentic-toolkit/adh/footer'

/** The serializable half of a link: what a server layout can hand across the
 *  boundary. NavLink's `icon`/function form and FooterLink's `onSelect` cannot
 *  cross it, and a site that needs either is not describing chrome any more.
 *  Derived from FooterLink so it narrows when that type does. */
type PlainLink = Pick<Extract<FooterLink, { href: string }>, 'label' | 'href'>

export type MarketingRootHtmlProps = {
  /** Optional site-owned header nav items — the serializable subset of NavLink (this is
   *  a server component, so the function form and icon fields can't cross the boundary;
   *  matchPaths keeps active-link highlighting available to sites). */
  navLinks?: Pick<NavLink, 'label' | 'href' | 'matchPaths'>[]
  /** Optional site-owned header items rendered OUTSIDE the collapsing nav, at the bar's
   *  trailing edge — an off-site destination (`toolkit`'s GitHub) rather than a route. */
  trailingNavLinks?: PlainLink[]
  /** Optional site-owned footer links, added to the shared legal/sites row. The
   *  copyright is the brand's, not the site's, and stays owned by SiteFooter. */
  footerLinks?: PlainLink[]
  /** The marketing site this document chrome is for — drives the header brand. */
  siteId: SiteId
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
  silentSso?: boolean
  children: ReactNode
}

/**
 * The shared root-document shell for the ADH marketing family. Every marketing
 * site's `app/layout.tsx` was byte-identical except its `siteId` + `metadata`
 * (and all 22 `providers.tsx` were byte-identical), so the whole `<html>` …
 * `<AppShell>` scaffold lives here once:
 *  • `<html lang dir>` from the active-locale seam (`getLocale`/`htmlLang`/`localeDir`)
 *  • `<head>` font preconnects + `<AdhThemeStyle/>` (the theme CSS variables)
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
 *  • `<AppShell header={<MarketingSiteHeader siteId/>} footer={…}>` — the shared
 *    chrome with the smart auth widget (avatar / Login+Sign up via SSO returnTo).
 *    `navLinks`/`trailingNavLinks`/`footerLinks` are the only per-site seams in it: a
 *    site with an off-site destination (toolkit's GitHub) declares it rather than
 *    hand-rolling the document to get at AppShell.
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
export function MarketingRootHtml({
  siteId,
  navLinks,
  trailingNavLinks,
  footerLinks,
  silentSso = true,
  children,
}: MarketingRootHtmlProps): ReactElement {
  const loc = getLocale()
  return (
    // suppressHydrationWarning: AdhThemeStyle's appearance pre-paint script sets class/data-*
    // on <html> before hydration (the user's colour mode), so the client tree legitimately
    // differs from the server's here. Same contract next-themes has.
    <html lang={htmlLang(loc)} dir={localeDir(loc)} suppressHydrationWarning>
      <head>
        <AdhThemeStyle />
      </head>
      <body>
        <AuthProvider clientId="adh" storageKey="auth_tokens" silentSso={silentSso}>
          <AppShell
            header={
              <MarketingSiteHeader
                siteId={siteId}
                navLinks={navLinks}
                trailingNavLinks={trailingNavLinks}
              />
            }
            footer={{ links: footerLinks ?? [] }}
          >
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
