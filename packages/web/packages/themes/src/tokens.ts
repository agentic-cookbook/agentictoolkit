// Theme CSS parsing — framework-free + isomorphic (no DOM, no React) so it's shared
// by the server-side AdhThemeStyle injector and the client theme editor: ONE parser,
// no drift. (The token-classification/grouping/serialisation helpers that once lived
// here were dropped when the editor moved to free-form CSS.)

const IMPORT_URL_RE = /@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)\s*;?/g
// The first `:root { … }` block of a generated adh theme css is its token block
// (the `.text-*` utilities + body that follow are theme-independent).
const ROOT_BLOCK_RE = /:root\s*\{[^}]*\}/
const PROP_RE = /(--[\w-]+)\s*:\s*([^;]+);/g

/** A theme's token map transferred as a delta: custom-property name → value. */
export type ThemeDelta = Record<string, string>

/** Split a theme css into its `@import` hrefs and the rest (imports removed). */
export function splitImports(css: string): { imports: string[]; rest: string } {
  const imports: string[] = []
  const rest = css.replace(IMPORT_URL_RE, (_, _q, href) => {
    imports.push(href)
    return ''
  })
  return { imports, rest }
}

/** Parse a generated theme's first `:root{}` block into an ordered prop→value map. */
export function parseRootProps(css: string): Map<string, string> {
  const block = css.match(ROOT_BLOCK_RE)?.[0] ?? ''
  const out = new Map<string, string>()
  for (const m of block.matchAll(PROP_RE)) {
    if (m[1] && m[2]) out.set(m[1], m[2].trim())
  }
  return out
}
