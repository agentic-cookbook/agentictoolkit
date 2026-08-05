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
//
// QUALIFIED before bare: an anchor may carry any run of document-state qualifiers —
// `[data-color-mode]:not(.dark)`, `[data-contrast='high']`, or both at once (a dark-always
// theme like fishlamp names every combination it has to out-specify). Those qualifiers
// describe the DOCUMENT, not the scoped element, so they move onto an `html` ancestor and
// the scope descends from it. Matching only the one light form left every other shape
// unrewritten — and rewrote `html:root[data-color-mode]:not(.dark)[data-contrast='high']`
// to `… :scope[data-contrast='high']`, hanging a document attribute on the scoped element,
// where it matches nothing. Both failures are silent; buildScopedCss.test.ts's last case
// asserts against the real stylesheets so a new anchor shape fails there instead.
//
// The anchor may also be INDENTED — a rule nested in an `@media (prefers-contrast: more)`
// block is the case that exists — so each pattern opens at a line start plus any leading
// horizontal whitespace, not at the line start alone. `[ \t]*` and not `\s*`: the latter
// eats newlines, which would let one match swallow a preceding blank line.
const ANCHOR = String.raw`(^[ \t]*|,\s*)`
const HTML_ROOT_QUALIFIED_RE = new RegExp(
  ANCHOR + String.raw`html:root((?:\[[^\]]*\]|:not\([^()]*\))+)`,
  'gm',
)
const HTML_ROOT_RE = new RegExp(ANCHOR + String.raw`html:root(?=[\s,{])`, 'gm')
const ROOT_DARK_RE = new RegExp(ANCHOR + String.raw`:root\.dark\b`, 'gm')
const ROOT_NOT_DARK_RE = new RegExp(ANCHOR + String.raw`:root:not\(\.dark\)`, 'gm')
const ROOT_RE = new RegExp(ANCHOR + String.raw`:root(?=[\s,{:])`, 'gm')
const BODY_RE = new RegExp(ANCHOR + String.raw`body(?=[\s,{:.])`, 'gm')

export function buildScopedCss(css: string, scope: string): string {
  const imports = (css.match(IMPORT_RE) || []).join('\n')
  const body = css
    .replace(IMPORT_RE, '')
    .replace(HTML_ROOT_QUALIFIED_RE, '$1html$2 :scope')
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
