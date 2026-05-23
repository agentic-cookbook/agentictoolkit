'use client'

import { useIsomorphicLayoutEffect } from '@agentic-toolkit/ui'
import { themes, type ThemeKey } from './manifest'

const GLOBAL_ID = 'agentic-toolkit-theme'
const SCOPED_ID = 'agentic-toolkit-theme-scoped'

const IMPORT_RE = /^@import\s+url\([^)]+\);\s*$/gm
const ROOT_DARK_RE = /(^|,\s*):root\.dark\b/gm
const ROOT_NOT_DARK_RE = /(^|,\s*):root:not\(\.dark\)/gm
const ROOT_RE = /(^|,\s*):root(?=[\s,{:])/gm
const BODY_RE = /(^|,\s*)body(?=[\s,{:.])/gm

function buildScopedCss(css: string, scope: string): string {
  const imports = (css.match(IMPORT_RE) || []).join('\n')
  const body = css
    .replace(IMPORT_RE, '')
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
