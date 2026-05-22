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
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        aria-label={`Open ${user.name} menu`}
      >
        <Avatar className="h-9 w-9">
          {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
          <AvatarFallback>{initialsOf(user.name) || <UserIcon className="h-4 w-4" />}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-[var(--color-text-primary)]">{user.name}</span>
          {user.email && (
            <span className="text-xs font-normal text-[var(--color-text-dim)]">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(onProfile || profileHref) &&
          (onProfile ? (
            <DropdownMenuItem onSelect={onProfile}>
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href={profileHref}>
                <UserIcon className="h-4 w-4" />
                <span>Profile</span>
              </a>
            </DropdownMenuItem>
          ))}
        {(onSettings || settingsHref) &&
          (onSettings ? (
            <DropdownMenuItem onSelect={onSettings}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <a href={settingsHref}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </a>
            </DropdownMenuItem>
          ))}
        {children}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout}>
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
