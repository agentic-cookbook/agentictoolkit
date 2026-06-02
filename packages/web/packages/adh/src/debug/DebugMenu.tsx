'use client'

import { Bug } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import { ThemeSwitcher } from '../themes/ThemeSwitcher'
import type { AdhThemeKey } from '../themes/adh-themes'
import { ChatThemeSwitcher, type ChatThemeOption } from './ChatThemeSwitcher'

export type DebugMenuChat = {
  themes: ChatThemeOption[]
  current: string | null
  onChange: (key: string | null) => void
  label?: string
}

export type DebugMenuProps = {
  /** Active site theme — sets the Theme sub-menu's current selection. */
  themeKey?: AdhThemeKey
  /**
   * When provided, shows a chat-theme sub-menu. The host supplies this only
   * when the chat feature is enabled (AI_CHAT), keeping the menu admin-safe.
   */
  chat?: DebugMenuChat
}

/**
 * A debug popup pinned to the upper-left of the viewport. The host mounts it on
 * every page (gated by DEBUG_MENU) in both the main and admin sites. It carries
 * the site theme switcher (moved here from the user menu) and, when enabled, a
 * chat-theme switcher.
 */
export function DebugMenu({ themeKey, chat }: DebugMenuProps) {
  return (
    <div className="adh-debug-menu">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Debug menu">
            <Bug className="adh-button__icon" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom">
          <DropdownMenuLabel>Debug</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ThemeSwitcher current={themeKey} />
          {chat && (
            <ChatThemeSwitcher
              themes={chat.themes}
              current={chat.current}
              onChange={chat.onChange}
              label={chat.label}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
