'use client'

import Link from 'next/link'
import { AvatarMenu, type AvatarMenuUser } from './AvatarMenu'
import { AuthButtons } from './AuthButtons'
import { SiteOptionsMenu, type SiteLink } from './SiteOptionsMenu'
import { NavLinkItem, type NavLink } from './NavLink'
import { ThemeSwitcher } from '../themes/ThemeSwitcher'
import type { AdhThemeKey } from '../themes/adh-themes'

export type AdhHeaderProps = {
  siteName: string
  siteNameHref?: string
  /** Optional page/section title, shown centered in the bar. */
  pageTitle?: string
  navLinks?: NavLink[]
  trailingNavLinks?: NavLink[]
  sites?: SiteLink[]
  user?: AvatarMenuUser | null
  themeKey?: AdhThemeKey
  loginHref?: string
  signupHref?: string
  onLogin?: () => void
  onSignup?: () => void
  onLogout?: () => void
  settingsHref?: string
  onSettings?: () => void
}

export function AdhHeader({
  siteName,
  siteNameHref = '/',
  pageTitle,
  navLinks = [],
  trailingNavLinks = [],
  sites,
  user,
  themeKey,
  loginHref,
  signupHref,
  onLogin,
  onSignup,
  onLogout,
  settingsHref,
  onSettings,
}: AdhHeaderProps) {
  // When logged in, primary nav lives inside the avatar dropdown — the bar
  // only carries the avatar trigger. When logged out, show the nav in the
  // bar but drop any link that just points at the site title (the title is
  // already the home link).
  const barLinks = user ? [] : navLinks.filter((l) => l.href !== siteNameHref)

  return (
    <header className="adh-header" role="banner">
      <div className="adh-header__container">
        <Link href={siteNameHref} className="adh-header__title">
          {siteName}
        </Link>
        {pageTitle && (
          <span className="adh-header__page-title">{pageTitle}</span>
        )}
        <nav className="adh-header__nav" aria-label="Primary">
          {barLinks.map((link) => (
            <NavLinkItem key={link.href + link.label} link={link} />
          ))}
          {sites && sites.length > 0 && <SiteOptionsMenu sites={sites} />}
          {user ? (
            <AvatarMenu
              user={user}
              navLinks={navLinks}
              onLogout={onLogout}
              settingsHref={settingsHref}
              onSettings={onSettings}
            >
              <ThemeSwitcher current={themeKey} />
            </AvatarMenu>
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
