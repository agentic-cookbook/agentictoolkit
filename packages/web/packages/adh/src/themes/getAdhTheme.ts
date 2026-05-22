import { cookies } from 'next/headers'
import { ADH_THEME_COOKIE, ADH_THEMES, DEFAULT_ADH_THEME, type AdhThemeKey } from './adh-themes'

const VALID_KEYS = new Set<string>(ADH_THEMES.map((t) => t.key))

export async function getAdhTheme(): Promise<AdhThemeKey> {
  const store = await cookies()
  const raw = store.get(ADH_THEME_COOKIE)?.value
  if (raw && VALID_KEYS.has(raw)) return raw as AdhThemeKey
  return DEFAULT_ADH_THEME
}
