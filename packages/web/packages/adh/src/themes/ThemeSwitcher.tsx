'use client'

import { Palette } from 'lucide-react'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../components/ui/dropdown-menu'
import { ADH_THEME_COOKIE, ADH_THEMES, type AdhThemeKey } from './adh-themes'

function selectTheme(key: AdhThemeKey): void {
  document.cookie = `${ADH_THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`
  window.location.reload()
}

export type ThemeSwitcherProps = {
  current?: AdhThemeKey
  label?: string
}

export function ThemeSwitcher({ current, label = 'Theme' }: ThemeSwitcherProps) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="adh-menu__item-icon" />
        <span>{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(value) => selectTheme(value as AdhThemeKey)}
          >
            {ADH_THEMES.map((theme) => (
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
