'use client'

import { useIsomorphicLayoutEffect } from '@agentic-toolkit/ui'
import { themes, type ThemeKey } from './manifest'

const GLOBAL_ID = 'agentic-toolkit-theme'
const SCOPED_ID = 'agentic-toolkit-theme-scoped'

const IMPORT_RE = /^@import\s+url\([^)]+\);\s*$/gm
// Full-palette themes — every theme with a complete M3 role layer — anchor their token
// blocks at `html:root` (dark, the default) and `html:root[data-color-mode]:not(.dark)`
// (light). The `:root` patterns below cannot see either: their `:root` is preceded by
// `html`, not by a line start or a comma. Without these two the whole palette of every
// full-palette theme is dropped in scoped mode and the scope silently keeps the host page's
// colours — the failure looks like "the theme did nothing", with no error anywhere.
// Light before dark: `html:root` is a prefix of the light selector.
const HTML_ROOT_LIGHT_RE = /(^|,\s*)html:root\[data-color-mode\]:not\(\.dark\)/gm
const HTML_ROOT_RE = /(^|,\s*)html:root(?=[\s,{])/gm
const ROOT_DARK_RE = /(^|,\s*):root\.dark\b/gm
const ROOT_NOT_DARK_RE = /(^|,\s*):root:not\(\.dark\)/gm
const ROOT_RE = /(^|,\s*):root(?=[\s,{:])/gm
const BODY_RE = /(^|,\s*)body(?=[\s,{:.])/gm

export function buildScopedCss(css: string, scope: string): string {
  const imports = (css.match(IMPORT_RE) || []).join('\n')
  const body = css
    .replace(IMPORT_RE, '')
    .replace(HTML_ROOT_LIGHT_RE, '$1html[data-color-mode]:not(.dark) :scope')
    .replace(HTML_ROOT_RE, '$1:scope')
    .replace(ROOT_DARK_RE, '$1html.dark :scope')
    .replace(ROOT_NOT_DARK_RE, '$1html:not(.dark) :scope')
    .replace(ROOT_RE, '$1:scope')
    .replace(BODY_RE, '$1:scope')
  return `${imports}\n@scope (${scope}) {\n${body}\n}`
}

export interface ThemeStyleProps {
  theme: ThemeKey
  scope?: string
}

export function ThemeStyle({ theme, scope }: ThemeStyleProps) {
  useIsomorphicLayoutEffect(() => {
    const entry = themes[theme]
    if (!entry) return
    const id = scope ? SCOPED_ID : GLOBAL_ID
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = scope ? buildScopedCss(entry.css, scope) : entry.css
  }, [theme, scope])

  return null
}
