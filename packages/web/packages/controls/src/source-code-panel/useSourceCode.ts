import { useEffect, useState } from 'react'
import type { UseSourceCodeArgs, UseSourceCodeResult } from './types'
import { ensureLanguage, ensureTheme, getHighlighter } from './highlighter'

export function useSourceCode(args: UseSourceCodeArgs): UseSourceCodeResult {
  const { code, lang = 'tsx', theme } = args
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const hl = await getHighlighter()
        await Promise.all([ensureLanguage(lang), ensureTheme(theme)])
        if (cancelled) return
        const out = hl.codeToHtml(code, { lang, theme })
        if (cancelled) return
        setHtml(out)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, lang, theme])

  return { html, loading, error }
}
