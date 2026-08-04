'use client'

import { type ReactNode } from 'react'
import { AvatarMenu, type AvatarMenuUser } from './AvatarMenu'
import { AuthButtons } from './AuthButtons'
import { SiteSwitcher } from './SiteSwitcher'
import { type SiteLink } from './SiteOptionsMenu'
import { NavLinkItem, type NavLink } from './NavLink'
import type { AdhThemeKey } from '../themes/adh-themes'
import { Badge } from '@agentic-toolkit/ui/components/badge'

/** A small pill shown under the site name. `tone` selects its colour. */
export type HeaderBadge = {
  label: string
  tone?: 'neutral' | 'accent' | 'orange' | 'blue'
}

/** The whole family is a pre-launch preview, and every header says so in the strip
 *  above the bar. Defined once here so launch is a one-line change: delete the
 *  constant's use below and the `.adh-header__preview` rules go quiet with it.
 *
 *  This replaced a `Preview Release` BADGE under the site name. A badge sat inside
 *  the bar's lead slot, so it competed with the brand for the one part of the header
 *  that has to survive a 390px phone; a full-width strip above the bar costs the bar
 *  no horizontal room at all, and reads as a property of the site rather than of its
 *  name. */
const PREVIEW_NOTICE = 'Developer Preview Release'

/** The auth-related slice of the header's props. An auth-aware wrapper in the
 *  consuming app supplies these from its auth source while the non-auth props are
 *  passed straight through. Kept as a named type so the source contract and the
 *  header can't drift apart — add an auth prop here and a derived type such as
 *  `HeaderAuthState` picks it up automatically. */
export type AdhHeaderAuthProps = {
  /** Transform a cross-site switcher destination href before use. Supplied by the
   *  auth-aware header when signed in, to route the switch through a silent SSO
   *  redirect so the target lands already logged in.
   *
   *  Consumed by a CALLER-SUPPLIED `siteSwitcher` (a registry-driven menu), not
   *  by the default switcher below — it lives on this type so the whole auth
   *  slice stays one object that a wrapper can forward in a single spread. */
  resolveSwitchHref?: (defaultHref: string) => string
  user?: AvatarMenuUser | null
  /** Auth is still resolving (the source's `isLoading`). While true the auth
   *  cluster shows a spinner instead of the login buttons, so a session resolving
   *  in the background never flashes "login / join" first. Defaults false. */
  authLoading?: boolean
  /** The signed-in user holds the host app's `admin` capability. Forwarded to a
   *  caller-supplied site switcher, where a registry-driven menu can use it to
   *  unlock an admin-only tail in EVERY env — production included. Ignored by the
   *  default switcher. */
  userIsAdmin?: boolean
  loginHref?: string
  signupHref?: string
  onLogin?: () => void
  onSignup?: () => void
  onLogout?: () => void
  settingsHref?: string
  onSettings?: () => void
}

export type AdhHeaderProps = AdhHeaderAuthProps & {
  /** The current site's display name — the default switcher's trigger text. */
  siteName: string
  /** Where the site name points when there is nowhere to switch to. */
  siteNameHref?: string
  /** Switch targets for the DEFAULT switcher. Ignored when `siteSwitcher` is set.
   *  This component performs no registry lookup: whoever knows the site family
   *  hands the list in. */
  sites?: SiteLink[]
  /** Rewrite a chosen target's href before navigating (default switcher only).
   *  Receives the target's `id`, or its `href` when it has no `id`. */
  onSwitchSite?: (idOrHref: string) => string | undefined
  /** Replaces the default `sites`-driven switcher in the header's lead slot.
   *
   *  This is the seam that keeps the header registry-free: a consumer whose site
   *  switcher must resolve a private registry (recents, workspaces, dev-tools
   *  flyouts) renders it itself and passes it here, from its own package. The
   *  default and the slot are mutually exclusive by
   *  construction: when this is set the default is not rendered at all. */
  siteSwitcher?: ReactNode
  /** Optional page/section title, shown centered in the bar. */
  pageTitle?: string
  /** Optional interactive content centered in the bar (e.g. a live status
   *  indicator + refresh). Unlike `pageTitle` it accepts arbitrary nodes and stays
   *  clickable. When set it occupies the centre slot in place of `pageTitle`. */
  center?: ReactNode
  /** Badges shown under the site name. Empty by default — the family-wide preview
   *  notice is the strip above the bar, not a badge. */
  badges?: HeaderBadge[]
  /** Site-specific controls injected at the start (left) of the right-hand
   *  cluster, before the nav links + auth. Used for functional controls a site
   *  needs in the bar (e.g. a cookbook's search/sidebar/theme). */
  leadingActions?: ReactNode
  navLinks?: NavLink[]
  trailingNavLinks?: NavLink[]
  /** Prominent links rendered AFTER the primary nav links and BEFORE the auth
   *  cluster — a distinct slot from `navLinks`, because the position is behavior:
   *  it is the last thing a signed-out visitor reads before "login / join", and it
   *  survives the signed-in collapse that empties `navLinks` from the bar.
   *
   *  A consumer whose site family gives some of its sites one extra prominent
   *  link fills this. The predicate that decides WHICH sites get one, and what
   *  the link says, is the consumer's own vocabulary and stays with the caller;
   *  the header only knows there is a slot here. */
  preAuthLinks?: ReactNode
  /** Where the avatar menu's "Home" points — the site's own post-login landing.
   *  This header resolves no site ids, so whoever knows the registry hands it in;
   *  defaults to the site root. */
  homeHref?: string
  /** The active theme key. Presentational hosts may key styling off it. */
  themeKey?: AdhThemeKey
}

export function AdhHeader({
  siteName,
  siteNameHref = '/',
  sites,
  onSwitchSite,
  siteSwitcher,
  pageTitle,
  center,
  badges = [],
  leadingActions,
  navLinks = [],
  trailingNavLinks = [],
  preAuthLinks,
  homeHref,
  user,
  authLoading = false,
  loginHref,
  signupHref,
  onLogin,
  onSignup,
  onLogout,
  settingsHref,
  onSettings,
}: AdhHeaderProps) {
  // The bar carries the primary nav in BOTH auth states. It used to be emptied when
  // signed in, because the avatar dropdown absorbed these links — that dropdown is an
  // account menu now (name / Home / Settings / Log out), so emptying the bar would
  // leave a signed-in visitor no nav at all. A site whose signed-in nav is long enough
  // to crowd the bar owns that: it should not hand the header a list it can't show.
  //
  // Either way, drop any link that just points at the site title: `SiteSwitcher`
  // already renders that href as the title, so keeping it here puts the same
  // destination in the bar twice.
  const barLinks = navLinks.filter((l) => l.href !== siteNameHref)

  return (
    <header className="adh-header" role="banner">
      {/* Family-wide preview notice, INSIDE the banner so it inherits the header's
          sticky/z-index and can never scroll away from the bar it qualifies. It is a
          full-width strip, so it takes no horizontal room from the bar below. */}
      <div className="adh-header__preview">
        <span className="adh-header__preview-text">{PREVIEW_NOTICE}</span>
      </div>
      <div className="adh-header__container">
        <div className="adh-header__lead">
          {/* Exactly one switcher: the caller's if it supplied one, else the
              built-in `sites` one. Never both. */}
          {siteSwitcher ?? (
            <SiteSwitcher
              siteName={siteName}
              siteNameHref={siteNameHref}
              sites={sites}
              onSwitchSite={onSwitchSite}
            />
          )}
          {badges.length > 0 && (
            <span className="adh-header__badges" aria-hidden="true">
              {badges.map((badge) => (
                // The ui Badge owns the skin; the adh-header__badge* classes stay
                // as stable hooks — they're a theme-editor surface.
                <Badge
                  key={badge.label}
                  variant={badge.tone ?? 'neutral'}
                  className={
                    badge.tone
                      ? `adh-header__badge adh-header__badge--${badge.tone}`
                      : 'adh-header__badge'
                  }
                >
                  {badge.label}
                </Badge>
              ))}
            </span>
          )}
        </div>
        {center ? (
          <div className="adh-header__center">{center}</div>
        ) : (
          pageTitle && <span className="adh-header__page-title">{pageTitle}</span>
        )}
        <nav className="adh-header__nav" aria-label="Primary">
          {leadingActions && (
            <span className="adh-header__actions">{leadingActions}</span>
          )}
          {/* The primary links, grouped so they can collapse together on a phone
              (see .adh-header__links). They're `display: contents` otherwise, so on
              a wide bar they still sit directly in the nav's flex row — same gaps,
              same layout as when they were bare children. */}
          {barLinks.length > 0 && (
            <span className="adh-header__links">
              {barLinks.map((link) => (
                <NavLinkItem key={link.href + link.label} link={link} />
              ))}
            </span>
          )}
          {/* Caller-supplied prominent links, before the auth cluster. */}
          {preAuthLinks}
          {authLoading && !user ? (
            <span
              className="adh-header__auth-spinner"
              role="status"
              aria-label="Checking sign-in"
            />
          ) : user ? (
            <AvatarMenu
              user={user}
              homeHref={homeHref}
              onLogout={onLogout}
              settingsHref={settingsHref}
              onSettings={onSettings}
            />
          ) : (
            <AuthButtons
              loginHref={loginHref}
              signupHref={signupHref}
              onLogin={onLogin}
              onSignup={onSignup}
            />
          )}
          {trailingNavLinks.map((link) => (
            <NavLinkItem key={link.href + link.label} link={link} />
          ))}
        </nav>
      </div>
    </header>
  )
}
