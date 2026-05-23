import type { ThemeKey } from '@agentic-web-toolkit/themes/manifest'

export const ADH_THEME_COOKIE = 'adh-theme'

export type AdhThemeKey = Extract<ThemeKey, `adh${string}`>

export type AdhThemeOption = {
  key: AdhThemeKey
  label: string
}

export const ADH_THEMES: AdhThemeOption[] = [
  { key: 'adh', label: 'ADH' },
  { key: 'adh-iosevka', label: 'Iosevka' },
  { key: 'adh-manrope', label: 'Manrope' },
  { key: 'adh-courier', label: 'Courier' },
  { key: 'adh-comic', label: 'Comic' },
  { key: 'adh-jetbrains', label: 'JetBrains' },
  { key: 'adh-fira', label: 'Fira' },
]

export const DEFAULT_ADH_THEME: AdhThemeKey = 'adh-manrope'
