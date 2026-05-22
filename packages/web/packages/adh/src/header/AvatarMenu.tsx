'use client'

import type { ReactNode } from 'react'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'

export type AvatarMenuUser = {
  name: string
  email?: string
  imageUrl?: string
}

export type AvatarMenuProps = {
  user: AvatarMenuUser
  onProfile?: () => void
  onSettings?: () => void
  onLogout?: () => void
  profileHref?: string
  settingsHref?: string
  children?: ReactNode
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AvatarMenu({
  user,
  onProfile,
  onSettings,
  onLogout,
  profileHref,
  settingsHref,
  children,
}: AvatarMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="adh-avatar-trigger" aria-label={`Open ${user.name} menu`}>
        <Avatar>
          {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
          <AvatarFallback>
            {initialsOf(user.name) || <UserIcon className="adh-menu__item-icon" />}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="adh-menu__label-name">{user.name}</span>
          {user.email && <span className="adh-menu__label-email">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(onProfile || profileHref) &&
          (onProfile ? (
            <DropdownMenuItem onSelect={onProfile}>
              <UserIcon className="adh-menu__item-icon" />
              <span>Profile</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href={profileHref}>
                <UserIcon className="adh-menu__item-icon" />
                <span>Profile</span>
              </a>
            </DropdownMenuItem>
          ))}
        {(onSettings || settingsHref) &&
          (onSettings ? (
            <DropdownMenuItem onSelect={onSettings}>
              <Settings className="adh-menu__item-icon" />
              <span>Settings</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href={settingsHref}>
                <Settings className="adh-menu__item-icon" />
                <span>Settings</span>
              </a>
            </DropdownMenuItem>
          ))}
        {children}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout}>
              <LogOut className="adh-menu__item-icon" />
              <span>Log out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
