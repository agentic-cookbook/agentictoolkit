'use client'

import type { ReactNode } from 'react'
import { ChevronDown, LogOut, Settings, User as UserIcon } from 'lucide-react'
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
  const avatarInner = (
    <Avatar className="h-9 w-9">
      {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
      <AvatarFallback>{initialsOf(user.name) || <UserIcon className="h-4 w-4" />}</AvatarFallback>
    </Avatar>
  )

  const avatarLinkClass =
    'rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]'

  const avatarLink = settingsHref ? (
    <a href={settingsHref} className={avatarLinkClass} aria-label={`${user.name} settings`}>
      {avatarInner}
    </a>
  ) : onSettings ? (
    <button
      type="button"
      onClick={onSettings}
      className={`${avatarLinkClass} border-0 bg-transparent p-0`}
      aria-label={`${user.name} settings`}
    >
      {avatarInner}
    </button>
  ) : (
    <span className={avatarLinkClass}>{avatarInner}</span>
  )

  return (
    <DropdownMenu>
      <div className="flex items-center gap-1">
        {avatarLink}
        <DropdownMenuTrigger
          className="flex h-7 w-5 items-center justify-center rounded-md text-[var(--color-text-secondary)] outline-none transition-colors hover:text-[var(--color-accent)] focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] data-[state=open]:text-[var(--color-accent)]"
          aria-label={`Open ${user.name} menu`}
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
      </div>
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
