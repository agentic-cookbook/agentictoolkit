import { themes } from '@agentic-web-toolkit/themes/manifest'
import type { AdhThemeKey } from './adh-themes'

export type AdhThemeStyleProps = {
  themeKey: AdhThemeKey
}

const IMPORT_URL_RE = /@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)\s*;?/g

function splitImports(css: string): { imports: string[]; rest: string } {
  const imports: string[] = []
  const rest = css.replace(IMPORT_URL_RE, (_, _q, href) => {
    imports.push(href)
    return ''
  })
  return { imports, rest }
}

export function AdhThemeStyle({ themeKey }: AdhThemeStyleProps) {
  const entry = themes[themeKey]
  if (!entry) return null
  const { imports, rest } = splitImports(entry.css)
  return (
    <>
      {imports.map((href) => (
        <link key={href} rel="stylesheet" href={href} data-adh-theme-import={themeKey} />
      ))}
      <style data-adh-theme={themeKey} dangerouslySetInnerHTML={{ __html: rest }} />
    </>
  )
}
