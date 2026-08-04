'use client'

import Link from 'next/link'
import { ChevronDown, Home, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@agentic-toolkit/ui/components/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
} from '@agentic-toolkit/ui/components/dropdown-menu'

export type AvatarMenuUser = {
  /** The resolved display name — an auth source picks the precedence (hub uses
   *  `displayName || slug`, every source then falls back through the email
   *  local-part to 'User'; see `toAvatarUser`). Never empty by contract, which is
   *  why this menu can show it unconditionally. */
  name: string
  imageUrl?: string
}

export type AvatarMenuProps = {
  user: AvatarMenuUser
  /** Where "Home" points. The site's own post-login landing, supplied by the
   *  registry-aware wrapper; defaults to the site root. */
  homeHref?: string
  onLogout?: () => void
  settingsHref?: string
  onSettings?: () => void
}

function initialsOf(name: string | undefined | null): string {
  if (!name) return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * The signed-in account menu: the avatar in the bar, and under it the user's name
 * plus the three account destinations — Home, Settings, Log out.
 *
 * It is an ACCOUNT menu, not a nav menu. A site's own destinations live in the bar
 * and in the site-name menu (the brand dropdown); routing them through here as well
 * grew this popup to the length of the site's whole feature list.
 */
export function AvatarMenu({
  user,
  homeHref = '/',
  onLogout,
  settingsHref,
  onSettings,
}: AvatarMenuProps) {
  const avatarInner = (
    <Avatar className="adh-avatar-menu-trigger__avatar">
      {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
      <AvatarFallback>{initialsOf(user.name) || <UserIcon className="adh-avatar-menu-trigger__fallback-icon" />}</AvatarFallback>
    </Avatar>
  )

  // The icon LEADS the label in every item (the label keeps `flex: 1`, so it still
  // fills the row) — one column of glyphs down the left edge reads as a list of
  // destinations, where a trailing icon read as a per-row affordance.
  const settingsBody = (
    <>
      <Settings className="adh-avatar-menu__item-icon" />
      <span className="adh-avatar-menu__item-label">Settings</span>
    </>
  )
  const settingsItem = settingsHref ? (
    <DropdownMenuLinkItem render={<Link href={settingsHref} />} className="adh-avatar-menu__item">
      {settingsBody}
    </DropdownMenuLinkItem>
  ) : onSettings ? (
    <DropdownMenuItem onClick={onSettings} className="adh-avatar-menu__item">
      {settingsBody}
    </DropdownMenuItem>
  ) : null

  return (
    <DropdownMenu>
      {/* The trigger is the avatar alone — no name, no slug. The name is still the
          trigger's ACCESSIBLE name (and heads the popup), so nothing is lost to a
          screen reader by dropping the visible copy. */}
      <DropdownMenuTrigger
        className="adh-avatar-menu-trigger"
        aria-label={`Open ${user.name} menu`}
      >
        <span className="adh-avatar-menu-trigger__avatar-wrap">{avatarInner}</span>
        <span className="adh-avatar-menu-trigger__chevron" aria-hidden="true">
          <ChevronDown className="adh-avatar-menu-trigger__chevron-icon" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="adh-avatar-menu" align="end" sideOffset={8}>
        <div className="adh-avatar-menu__header">
          <div className="adh-avatar-menu__identity">
            <span className="adh-avatar-menu__name">{user.name}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href={homeHref} />} className="adh-avatar-menu__item">
          <Home className="adh-avatar-menu__item-icon" />
          <span className="adh-avatar-menu__item-label">Home</span>
        </DropdownMenuLinkItem>
        {settingsItem && (
          <>
            <DropdownMenuSeparator />
            {settingsItem}
          </>
        )}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className="adh-avatar-menu__item"
            >
              <LogOut className="adh-avatar-menu__item-icon" />
              <span className="adh-avatar-menu__item-label">Log out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
