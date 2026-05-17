/**
 * Singleton Shiki highlighter. Loaded once per page; new languages and
 * themes are added on demand. Keeps the bundle lean — we only pay for
 * grammars/themes consumers actually ask for.
 */
import type { Highlighter } from 'shiki'

const DEFAULT_LANGS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'json',
  'bash',
  'sh',
  'md',
  'html',
  'swift',
  'objective-c',
  'sql',
] as const
const DEFAULT_THEMES = ['github-light', 'github-dark'] as const

let instance: Promise<Highlighter> | null = null
const loadedLangs = new Set<string>(DEFAULT_LANGS)
const loadedThemes = new Set<string>(DEFAULT_THEMES)
const inflight = new Map<string, Promise<void>>()

export async function getHighlighter(): Promise<Highlighter> {
  if (instance) return instance
  instance = (async () => {
    const { createHighlighter } = await import('shiki')
    return createHighlighter({
      langs: [...DEFAULT_LANGS],
      themes: [...DEFAULT_THEMES],
    })
  })()
  return instance
}

export async function ensureLanguage(lang: string): Promise<void> {
  if (loadedLangs.has(lang)) return
  const key = `lang:${lang}`
  let pending = inflight.get(key)
  if (!pending) {
    pending = (async () => {
      const hl = await getHighlighter()
      await hl.loadLanguage(lang as Parameters<Highlighter['loadLanguage']>[0])
      loadedLangs.add(lang)
    })()
    inflight.set(key, pending)
  }
  try {
    await pending
  } finally {
    inflight.delete(key)
  }
}

export async function ensureTheme(theme: string): Promise<void> {
  if (loadedThemes.has(theme)) return
  const key = `theme:${theme}`
  let pending = inflight.get(key)
  if (!pending) {
    pending = (async () => {
      const hl = await getHighlighter()
      await hl.loadTheme(theme as Parameters<Highlighter['loadTheme']>[0])
      loadedThemes.add(theme)
    })()
    inflight.set(key, pending)
  }
  try {
    await pending
  } finally {
    inflight.delete(key)
  }
}
