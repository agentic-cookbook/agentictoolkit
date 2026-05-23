'use client'

import { Palette } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../components/ui/dropdown-menu'
import { ADH_THEME_COOKIE, ADH_THEMES, type AdhThemeKey } from './adh-themes'

export type ThemeSwitcherProps = {
  current?: AdhThemeKey
  label?: string
  // Custom handler; if omitted the switcher writes the cookie and calls
  // router.refresh() — a soft RSC refresh that keeps form state intact.
  onThemeChange?: (key: AdhThemeKey) => void
}

export function ThemeSwitcher({
  current,
  label = 'Theme',
  onThemeChange,
}: ThemeSwitcherProps) {
  const router = useRouter()

  const selectTheme = (key: AdhThemeKey): void => {
    document.cookie = `${ADH_THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`
    if (onThemeChange) {
      onThemeChange(key)
    } else {
      router.refresh()
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="h-4 w-4" />
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
