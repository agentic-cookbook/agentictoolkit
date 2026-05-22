'use client'

import { AvatarMenu, type AvatarMenuUser } from './AvatarMenu'
import { AuthButtons } from './AuthButtons'
import { SiteOptionsMenu, type SiteLink } from './SiteOptionsMenu'
import { NavLinkItem, type NavLink } from './NavLink'
import { ThemeSwitcher } from '../themes/ThemeSwitcher'
import type { AdhThemeKey } from '../themes/adh-themes'

export type AdhHeaderProps = {
  siteName: string
  siteNameEmphasis?: string
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
  siteNameEmphasis,
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
      className="flex h-14 items-center gap-6 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[var(--color-text-primary)]"
      role="banner"
    >
      <a
        href={siteNameHref}
        className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
      >
        {siteNameEmphasis && (
          <span className="text-[var(--color-accent)]">{siteNameEmphasis}</span>
        )}
        <span>{siteName}</span>
      </a>
      {navLinks.length > 0 && (
        <nav className="flex items-center gap-4" aria-label="Primary">
          {navLinks.map((link) => (
            <NavLinkItem key={link.href + link.label} link={link} />
          ))}
        </nav>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-2">
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
      </div>
    </header>
  )
}
