'use client'

import { AvatarMenu, type AvatarMenuUser } from './AvatarMenu'
import { AuthButtons } from './AuthButtons'
import { SiteOptionsMenu, type SiteLink } from './SiteOptionsMenu'
import { NavLinkItem, type NavLink } from './NavLink'
import { ThemeSwitcher } from '../themes/ThemeSwitcher'
import type { AdhThemeKey } from '../themes/adh-themes'

export type AdhHeaderProps = {
  siteName: string
  siteNameHref?: string
  navLinks?: NavLink[]
  sites?: SiteLink[]
  user?: AvatarMenuUser | null
  themeKey?: AdhThemeKey
  loginHref?: string
  signupHref?: string
  onLogin?: () => void
  onSignup?: () => void
  onLogout?: () => void
  profileHref?: string
  settingsHref?: string
  onProfile?: () => void
  onSettings?: () => void
}

export function AdhHeader({
  siteName,
  siteNameHref = '/',
  navLinks = [],
  sites,
  user,
  themeKey,
  loginHref,
  signupHref,
  onLogin,
  onSignup,
  onLogout,
  profileHref,
  settingsHref,
  onProfile,
  onSettings,
}: AdhHeaderProps) {
  return (
    <header
      className="adh-header border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
      role="banner"
    >
      <div className="adh-header__container mx-auto flex h-14 items-center justify-between gap-6 px-4">
        <a href={siteNameHref} className="adh-header__title">
          {siteName}
        </a>
        <nav className="adh-header__nav flex items-center gap-5" aria-label="Primary">
          {navLinks.map((link) => (
            <NavLinkItem key={link.href + link.label} link={link} />
          ))}
          {sites && sites.length > 0 && <SiteOptionsMenu sites={sites} />}
          {user ? (
            <AvatarMenu
              user={user}
              onLogout={onLogout}
              onProfile={onProfile}
              onSettings={onSettings}
              profileHref={profileHref}
              settingsHref={settingsHref}
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
        </nav>
      </div>
    </header>
  )
}
