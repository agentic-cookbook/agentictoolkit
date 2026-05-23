'use client'

import type { ReactNode } from 'react'
import { ChevronDown, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import type { NavLink } from './NavLink'

export type AvatarMenuUser = {
  name: string
  email?: string
  imageUrl?: string
}

export type AvatarMenuProps = {
  user: AvatarMenuUser
  navLinks?: NavLink[]
  onLogout?: () => void
  settingsHref?: string
  onSettings?: () => void
  children?: ReactNode
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

export function AvatarMenu({
  user,
  navLinks = [],
  onLogout,
  settingsHref,
  onSettings,
  children,
}: AvatarMenuProps) {
  const avatarInner = (
    <Avatar className="adh-avatar-menu-trigger__avatar">
      {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
      <AvatarFallback>{initialsOf(user.name) || <UserIcon className="h-4 w-4" />}</AvatarFallback>
    </Avatar>
  )

  const settingsItem = settingsHref ? (
    <DropdownMenuItem asChild>
      <a href={settingsHref} className="adh-avatar-menu__item">
        <span className="adh-avatar-menu__item-label">Settings</span>
        <Settings className="adh-avatar-menu__item-icon" />
      </a>
    </DropdownMenuItem>
  ) : onSettings ? (
    <DropdownMenuItem onSelect={onSettings} className="adh-avatar-menu__item">
      <span className="adh-avatar-menu__item-label">Settings</span>
      <Settings className="adh-avatar-menu__item-icon" />
    </DropdownMenuItem>
  ) : null

  return (
    <DropdownMenu>
      <div className="adh-avatar-menu-trigger">
        <span className="adh-avatar-menu-trigger__name">{user.name}</span>
        <span className="adh-avatar-menu-trigger__avatar-wrap">{avatarInner}</span>
        <DropdownMenuTrigger
          className="adh-avatar-menu-trigger__chevron"
          aria-label={`Open ${user.name} menu`}
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="adh-avatar-menu" align="end" sideOffset={8}>
        <div className="adh-avatar-menu__header">
          <div className="adh-avatar-menu__identity">
            <span className="adh-avatar-menu__name">{user.name}</span>
            {user.email && (
              <span className="adh-avatar-menu__email">{user.email}</span>
            )}
          </div>
        </div>
        {navLinks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <DropdownMenuItem asChild key={link.href + link.label}>
                  <a href={link.href} className="adh-avatar-menu__item">
                    <span className="adh-avatar-menu__item-label">{link.label}</span>
                    {Icon ? <Icon className="adh-avatar-menu__item-icon" /> : null}
                  </a>
                </DropdownMenuItem>
              )
            })}
          </>
        )}
        {settingsItem && (
          <>
            <DropdownMenuSeparator />
            {settingsItem}
          </>
        )}
        {children && (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        )}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onLogout}
              className="adh-avatar-menu__item"
            >
              <span className="adh-avatar-menu__item-label">Log out</span>
              <LogOut className="adh-avatar-menu__item-icon" />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
