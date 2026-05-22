import { themes } from '@agentic-web-toolkit/themes/manifest'
import type { AdhThemeKey } from './adh-themes'

export type AdhThemeStyleProps = {
  themeKey: AdhThemeKey
}

export function AdhThemeStyle({ themeKey }: AdhThemeStyleProps) {
  const entry = themes[themeKey]
  if (!entry) return null
  return (
    <style
      data-adh-theme={themeKey}
      dangerouslySetInnerHTML={{ __html: entry.css }}
    />
  )
}
