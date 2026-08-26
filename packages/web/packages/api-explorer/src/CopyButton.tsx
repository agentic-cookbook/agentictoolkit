'use client'

import { Check, Copy } from 'lucide-react'
import { useClipboard } from '@agenticdevelopertoolkit/ui/hooks/useClipboard'

/**
 * The copy-to-clipboard button for a code block — the single interactive island shared by the
 * client {@link CodeBlock} (which highlights in the browser) and the server-rendered
 * {@link StaticCodeBlock} (which is pre-highlighted at build time). Absolutely positioned by its
 * `.adh-api-code` parent; reveals on hover/focus.
 */
export function CopyButton({ code }: { code: string }) {
  const { copied, copy } = useClipboard()
  return (
    <button
      type="button"
      onClick={() => void copy(code)}
      className="absolute right-2 top-2 z-10 rounded-md border border-apt-border bg-apt-surface/85 p-1.5 text-apt-text-muted opacity-0 transition hover:text-apt-text focus-visible:opacity-100 group-hover:opacity-100"
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  )
}
