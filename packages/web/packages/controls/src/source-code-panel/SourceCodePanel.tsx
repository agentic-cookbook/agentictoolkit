'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SourceCodePanelProps } from './types'
import { useSourceCode } from './useSourceCode'

const FALLBACK_THEME = 'github-dark'

/**
 * Read the toolkit-theme-controlled Shiki theme. Each global theme CSS
 * declares `--scp-shiki-theme: 'github-light' | 'github-dark' | …`. We
 * read the computed value on the panel root, strip surrounding quotes
 * (CSS strings come back as `'github-dark'` literally), and fall back if
 * unset.
 */
function readShikiTheme(el: HTMLElement | null): string {
  if (!el) return FALLBACK_THEME
  const raw = getComputedStyle(el).getPropertyValue('--scp-shiki-theme').trim()
  if (!raw) return FALLBACK_THEME
  return raw.replace(/^['"]|['"]$/g, '')
}

export function SourceCodePanel(props: SourceCodePanelProps) {
  const { code, lang = 'tsx', theme: themeProp, showCopy = true, filename, className, maxHeight } = props

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [resolvedTheme, setResolvedTheme] = useState<string>(themeProp ?? FALLBACK_THEME)

  // Track the active Shiki theme. If the consumer passed `theme`, that wins.
  // Otherwise derive it from `--scp-shiki-theme` on the panel root, and re-read
  // whenever the toolkit theme `<style>` element mutates (theme switches).
  useEffect(() => {
    if (themeProp) {
      setResolvedTheme(themeProp)
      return
    }
    const update = () => setResolvedTheme(readShikiTheme(rootRef.current))
    update()
    const styleEl = document.getElementById('agentic-toolkit-theme')
    if (!styleEl) return
    const observer = new MutationObserver(update)
    observer.observe(styleEl, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [themeProp])

  const { html, loading, error } = useSourceCode({ code, lang, theme: resolvedTheme })
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Permission denied or no clipboard — silently no-op.
    }
  }, [code])

  const rootClass = className ? `scp-root ${className}` : 'scp-root'
  const showHeader = Boolean(filename) || showCopy

  return (
    <div ref={rootRef} className={rootClass}>
      {showHeader && (
        <div className="scp-header">
          <span className="scp-filename">{filename ?? lang}</span>
          {showCopy && (
            <button type="button" className="scp-copy" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}
      <div className="scp-body" style={maxHeight !== undefined ? { maxHeight } : undefined}>
        {error ? (
          <pre className="scp-fallback">
            <code>{code}</code>
          </pre>
        ) : html ? (
          <div className="scp-shiki" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="scp-fallback" aria-busy={loading || undefined}>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
