import { useCallback, useEffect, useRef, useState } from "react"

// Copy text to the clipboard and flag `copied` for `resetMs` so callers can show a
// transient "Copied" affirmation. Generic browser util — no domain knowledge.
export function useClipboard(resetMs = 1500): {
  copied: boolean
  copy: (text: string) => Promise<boolean>
} {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetMs)
        return true
      } catch {
        setCopied(false)
        return false
      }
    },
    [resetMs],
  )

  return { copied, copy }
}
