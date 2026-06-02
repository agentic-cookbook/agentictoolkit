'use client'

import { MessageSquare } from 'lucide-react'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../components/ui/dropdown-menu'

export type ChatThemeOption = { key: string; label: string }

/** Sentinel radio value for "no chat theme — use the app default". */
const DEFAULT_VALUE = '__default'

export type ChatThemeSwitcherProps = {
  /** The available chat themes (supplied by the host — keeps this admin-safe). */
  themes: ChatThemeOption[]
  /** The selected chat theme key, or `null` for the app default. */
  current: string | null
  onChange: (key: string | null) => void
  label?: string
}

/**
 * A data-driven theme sub-menu for the chat surface. Mirrors the site
 * `ThemeSwitcher` but takes its theme list + current/onChange as props so the
 * shared debug menu never has to depend on the chat themes package directly.
 */
export function ChatThemeSwitcher({
  themes,
  current,
  onChange,
  label = 'Chat theme',
}: ChatThemeSwitcherProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <MessageSquare className="adh-dropdown-menu__item-icon" />
        <span>{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={current ?? DEFAULT_VALUE}
            onValueChange={(value) =>
              onChange(value === DEFAULT_VALUE ? null : value)
            }
          >
            <DropdownMenuRadioItem value={DEFAULT_VALUE}>
              App default
            </DropdownMenuRadioItem>
            {themes.map((theme) => (
              <DropdownMenuRadioItem key={theme.key} value={theme.key}>
                {theme.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}
