/**
 * Minimal shiki wrapper: highlight a JSON/bash/js string to HTML with BOTH the
 * light and dark themes emitted as `--shiki-light` / `--shiki-dark` CSS variables
 * (`defaultColor: false`). The panel CSS selects the variant off the app's `.dark`
 * class, so highlighted code follows the theme with no re-highlight. Shiki is
 * dynamically imported (and module-cached) so its payload only loads when the
 * panel first renders code.
 */

import type { Highlighter } from 'shiki'

export type HighlightLang = 'json' | 'bash' | 'javascript'

// Module-cached so shiki's payload loads once, on first use. Type-only import of
// `Highlighter` is erased at build, so `shiki` stays a lazily-imported external.
// NOTE: this deliberately mirrors @agentic-toolkit/markdown's shiki singleton + the
// dual-theme CSS-var scheme in api-explorer.css. It is NOT factored into a shared
// helper on purpose: markdown's highlighter lives inside a unified/rehype pipeline
// (heavy deps we don't want to pull in), and a shared package for ~15 lines isn't
// worth the coupling. Keep the two theme lists in sync if you touch either.
let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(({ createHighlighter }) =>
        createHighlighter({
          themes: ['github-light', 'github-dark'],
          langs: ['json', 'bash', 'javascript'],
        }),
      )
      .catch((err) => {
        // Don't cache a rejection — a transient chunk-load failure would otherwise
        // disable highlighting for the whole session. Reset so the next call retries.
        highlighterPromise = null
        throw err
      })
  }
  return highlighterPromise
}

export async function highlightToHtml(code: string, lang: HighlightLang): Promise<string> {
  const highlighter = await getHighlighter()
  return highlighter.codeToHtml(code, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
}

/** Pretty-print a raw response body when it's JSON; otherwise return it as-is. */
export function prettyJson(text: string): { text: string; lang: HighlightLang } {
  const trimmed = text.trim()
  if (trimmed === '') return { text: '', lang: 'json' }
  try {
    return { text: JSON.stringify(JSON.parse(trimmed), null, 2), lang: 'json' }
  } catch {
    return { text, lang: 'json' }
  }
}
