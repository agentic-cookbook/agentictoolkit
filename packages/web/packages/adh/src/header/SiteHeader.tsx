'use client'

import { type ReactElement } from 'react'
import {
  AdhHeader,
  useClientHost,
  type AdhHeaderAuthProps,
  type HeaderBadge,
  type NavLink,
  type RouteSection,
} from '@agentic-toolkit/adh/header'
// The auth-source contract + the public-site default. Its own subpath, not the header
// barrel: it is the only header module that value-imports @agentic-toolkit/auth, so a
// site that renders a nav link should not pull the auth package in behind it.
import { useAnonymousHeaderAuth, type HeaderAuthSource } from '@agentic-toolkit/adh/header-auth'
import { getSite, siteHeaderTitle, siteHomePath, siteProdUrl, siteUrl, type SiteId } from '@agentic-toolkit/adh-registry'
// The participation leaf, not the '@agentic-toolkit/adh/concepts' barrel: this needs one
// predicate, and the barrel would put the whole taxonomy (structure + content JSON)
// behind the always-loaded header. PRESERVED IMPORT — the package path, never
// '../concepts/participating': the concepts barrel reaches the same module, and a
// relative specifier would give this entry its own copy of its module-level Set.
import { isConceptSite } from '@agentic-toolkit/adh/concepts/participating'
import { SiteMenuSwitcher } from './SiteMenuSwitcher'

import type { ReactNode } from 'react'

/**
 * Everything the auth SOURCE owns is Omitted from the public props, so a caller can
 * never clobber it: `user`, `onLogin`, `onLogout`, `resolveSwitchHref` and
 * `authLoading` come from `useAuthSource` and nowhere else. The remaining auth fields
 * (`loginHref`, `signupHref`, `onSignup`, `userIsAdmin`, `settingsHref`, `onSettings`)
 * stay settable per site and WIN over a same-named field the source returns — the
 * precedence the two-component version got from `{...auth} {...rest}`.
 */
export type SiteHeaderProps = Omit<
  AdhHeaderAuthProps,
  'user' | 'onLogin' | 'onLogout' | 'resolveSwitchHref' | 'authLoading'
> & {
  /** Which site this header belongs to. The display name + the site-switcher's
   *  contents come from the shared sites registry. */
  siteId: SiteId
  /** Optional page/section title, shown centered in the bar. */
  pageTitle?: string
  /** Optional interactive content centered in the bar (e.g. the status site's live
   *  indicator + refresh). Unlike `pageTitle` it accepts arbitrary nodes and stays
   *  clickable. When set it occupies the centre slot in place of `pageTitle`. */
  center?: ReactNode
  /** Badges shown under the site name. None by default — the family's preview
   *  notice is the strip the toolkit header draws above the bar, not a badge. */
  badges?: HeaderBadge[]
  /** Site-specific controls injected at the start (left) of the right-hand cluster,
   *  before the nav links + auth. Used for functional controls a site needs in the
   *  bar (e.g. cookbook's search/sidebar/theme). */
  leadingActions?: ReactNode
  /** Static nav links, or a builder given the signed-in flag — resolved AFTER the auth
   *  source runs, so a site can vary its nav by auth state without reading auth itself
   *  (which keeps the page's own header component hook-free). */
  navLinks?: NavLink[] | ((signedIn: boolean) => NavLink[])
  trailingNavLinks?: NavLink[]
  /** Curated route map, forwarded straight through to the site-menu's "Routes"
   *  flyout (see SiteMenu's devToolsSection) for quick in-app jumping. The flyout
   *  shows only in local/testing/staging or to a signed-in adh admin (any env); when
   *  a site passes none it falls back to the generated per-site route map. */
  routes?: RouteSection[]
  /** The signed-in user's personal workspace slug, forwarded to the site-switcher as
   *  the in-hub slug fallback on the slug-less workspace shell routes (`/home`,
   *  `/home/settings`, …). The hub's header passes the signed-in `user.slug`;
   *  harmless (and ignored) off the hub. */
  personalSlug?: string
  /** OAuth client id for the login redirect (default 'adh', the shared brand-site
   *  client). Forwarded to the auth source, which decides what to do with it. */
  clientId?: string
  /** Called after a successful logout — e.g. to navigate away from a gated page.
   *  Consumed only by sources that own a logout; the built-in non-adh sources
   *  receive it via opts and ignore it. */
  onAfterLogout?: () => void
  /**
   * Inject a different auth source — a hook returning `HeaderAuthState`. Defaults to
   * the anonymous public-site source (a fixed logged-out bar that never reads the
   * session), so a site with no adh AuthProvider above it — the status board — renders
   * fine. The hub and admin pass their own session-reading sources; the
   * marketing/feature-site family passes the shared smart SSO one.
   *
   * Named with the `use` prefix because this component invokes it AS a hook,
   * unconditionally at the top of its body: pass a STABLE, top-level hook, never an
   * inline-redefined function, or hook order breaks between renders.
   */
  useAuthSource?: HeaderAuthSource
}

/**
 * adh's header: the toolkit's registry-free {@link AdhHeader} plus everything that
 * needs the adh site registry.
 *
 * The split is the point. `@agentic-toolkit/adh`'s header knows about a bar, slots,
 * badges and an auth cluster and nothing else — it resolves no site ids and holds no
 * site list, so a non-adh consumer can use it. Everything registry-shaped lives
 * HERE: the site's display name, the env-aware hub login/signup/settings hrefs, the
 * concept-site "Details" affordance, and adh's real {@link SiteMenuSwitcher} (the
 * marketing/workspace menu taxonomy with its recents, workspaces and dev-tools
 * flyouts), injected through the header's `siteSwitcher` slot.
 *
 * The AUTH wiring is injected too, and for the same reason the switcher is: which
 * session a site reads is the site's business, not the header's. Task 6.2 folded the
 * @adh-shared auth-shim wrapper that used to supply it into this component, so there is
 * one SiteHeader again — a site cannot get the registry half without the auth half.
 */
export function SiteHeader({
  siteId,
  pageTitle,
  center,
  badges,
  leadingActions,
  navLinks,
  trailingNavLinks = [],
  routes,
  personalSlug,
  clientId,
  onAfterLogout,
  useAuthSource = useAnonymousHeaderAuth,
  ...authOverrides
}: SiteHeaderProps): ReactElement {
  // The chosen source is the ONLY one invoked, unconditionally and first, so its own
  // hooks run in a stable order ahead of this component's — and a site with no adh
  // AuthProvider (status) never reaches a `useAuth()` at all, because the default
  // source has none.
  // `siteId` rides along so a session-aware source can resolve THIS site's post-login
  // landing without being rebuilt per site (MarketingSiteHeader builds one source at
  // module scope for the whole family).
  const source = useAuthSource({ clientId, siteId, onAfterLogout })
  // Source first, caller's explicit props last: the source owns the five fields
  // SiteHeaderProps Omits (so `authOverrides` structurally cannot carry them), while a
  // site's static header config (loginHref, settingsHref, …) still wins over a
  // same-named field the source happened to return. Exactly the precedence the
  // `{...auth} {...rest}` spread in the retired wrapper produced.
  const {
    resolveSwitchHref,
    user,
    userIsAdmin,
    authLoading = false,
    loginHref,
    signupHref,
    onLogin,
    onSignup,
    onLogout,
    settingsHref,
    onSettings,
  } = { ...source, ...authOverrides }
  // Auth-dependent nav resolved HERE, after the source decided signed-in-or-not, so a
  // page's header component doesn't need its own useAuth() read just to vary its nav.
  const resolvedNavLinks = (typeof navLinks === 'function' ? navLinks(user != null) : navLinks) ?? []

  // Login/Join live on the hub for every site. A site can override with its own
  // hrefs (the hub passes local /login, /signup); otherwise default to the hub's
  // auth in the current environment. Null on the server + first client render
  // (deterministic — no hydration mismatch), then the env-aware host once mounted.
  const hostname = useClientHost()

  // Concept-graph sites carry a prominent "Details" link before the auth links.
  // Env is read client-side from the hostname (null on SSR/first render → links
  // appear after hydration), mirroring how the auth hrefs upgrade — deterministic,
  // no hydration mismatch.
  const conceptSite = isConceptSite(siteId)
  // The registry-derived brand name. `siteHeaderTitle` takes the SiteDef, not the id;
  // an unknown id can't happen through the typed `SiteId`, but `getSite` is
  // nominally partial, so fall back to the id rather than widening its return.
  const site = getSite(siteId)
  const siteName = site ? siteHeaderTitle(site) : siteId
  const resolveHubHref = (path: string): string =>
    hostname ? siteUrl('hub', path, hostname) : siteProdUrl('hub', path)
  // Default Login / Sign up carry a `?return_to=` back to THIS site's post-login
  // landing (its /home, or root when it has none), so the hub's /login + /signup
  // send the visitor back here once signed in instead of stranding them on the
  // hub's own /home. `return_to` (the visitor-facing destination) is deliberately
  // NOT the AS's internal `?return=` central-relay callback — hub /login treats
  // those differently (a `return=` relay means no central session yet, so it shows
  // the card; a `return_to` link means "bounce me back once recognized"). See
  // docs/platform/login-and-return.md. Deterministic prod host on SSR/first render
  // (mirrors the hub hrefs above), env-aware once mounted. Skipped when the site
  // drives auth itself (onLogin/onSignup handler) or overrides the href.
  const selfReturn = hostname
    ? siteUrl(siteId, siteHomePath(siteId), hostname)
    : siteProdUrl(siteId, siteHomePath(siteId))
  const hubAuthHref = (path: string): string =>
    `${resolveHubHref(path)}?return_to=${encodeURIComponent(selfReturn)}`
  const resolvedLoginHref = loginHref ?? (onLogin ? undefined : hubAuthHref('/login'))
  const resolvedSignupHref = signupHref ?? (onSignup ? undefined : hubAuthHref('/signup'))

  // The signed-in settings gear in the switcher: prefer the host's in-app overlay
  // (onSettings); otherwise make the gear a link — to the site's own settingsHref
  // if it set one, else the hub's settings page (satellites redirect there). Only
  // a link target here; the switcher gates its visibility on `user != null`.
  const switcherSettingsHref = onSettings
    ? undefined
    : (settingsHref ?? resolveHubHref('/home/settings'))

  return (
    <AdhHeader
      // The registry-derived display name. adh always fills the `siteSwitcher` slot
      // below, so this reaches no rendered node today — it is passed because it is
      // the honest value, and because it is what the toolkit's default switcher
      // would show if the slot were ever dropped.
      siteName={siteName}
      siteSwitcher={
        <SiteMenuSwitcher
          currentSiteId={siteId}
          resolveHref={resolveSwitchHref}
          personalSlug={personalSlug}
          authenticated={user != null}
          onSettings={onSettings}
          settingsHref={switcherSettingsHref}
          // Signed-out top section: the menu's Login / Sign up rows reuse the same
          // env-resolved hrefs as the header's auth buttons (omitted when the site
          // uses onLogin/onSignup callbacks instead of hrefs).
          loginHref={resolvedLoginHref}
          signupHref={resolvedSignupHref}
          // Dev Routes flyout data — the flyout itself decides (env gate or the
          // admin unlock) whether it's actually shown; see SiteMenu's devToolsSection.
          routes={routes}
          userIsAdmin={userIsAdmin}
        />
      }
      pageTitle={pageTitle}
      center={center}
      badges={badges}
      leadingActions={leadingActions}
      navLinks={resolvedNavLinks}
      trailingNavLinks={trailingNavLinks}
      // The avatar menu's "Home" — THIS site's post-login landing (its /home, or root
      // when it has none), the same destination the default Login/Join links already
      // return to. A relative path, not `selfReturn`'s absolute URL: Home never leaves
      // the site, so it should navigate client-side rather than reload through the
      // env-resolved origin.
      homeHref={siteHomePath(siteId)}
      // Concept-graph affordances, before the auth cluster. A plain anchor so it
      // works pre-hydration and resolves the real route. The `/details` path and the
      // "Details" copy are adh vocabulary and stay on this side of the boundary.
      preAuthLinks={
        conceptSite ? (
          <a href="/details" className="adh-header__nav-link adh-header__nav-link--details">
            Details
          </a>
        ) : undefined
      }
      user={user}
      authLoading={authLoading}
      loginHref={resolvedLoginHref}
      signupHref={resolvedSignupHref}
      onLogin={onLogin}
      onSignup={onSignup}
      onLogout={onLogout}
      settingsHref={settingsHref}
      onSettings={onSettings}
    />
  )
}
