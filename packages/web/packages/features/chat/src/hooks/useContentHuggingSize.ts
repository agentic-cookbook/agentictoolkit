import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { InlineChatSizing } from '../modes/InlineChat'

const HUGGING_CLASS = 'pc-hugging'

interface HuggingSize {
  ref: RefObject<HTMLDivElement | null>
  style: CSSProperties
}

export function useContentHuggingSize(sizing: InlineChatSizing | undefined): HuggingSize {
  const ref = useRef<HTMLDivElement | null>(null)
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(null)

  const isHugging = sizing?.mode === 'content-hugging'

  useLayoutEffect(() => {
    if (!isHugging) return
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return

    const el = ref.current
    if (!el) return

    el.classList.add(HUGGING_CLASS)
    // The chat is laid out inside a positioning wrapper (e.g. `.pc-inline`).
    // That wrapper has its own fixed height, which would clamp the chat's auto
    // height and break "grows up" anchoring. Tag the wrapper too so CSS can
    // release it.
    const parent = el.parentElement
    parent?.classList.add(HUGGING_CLASS)

    const recompute = () => {
      const chatBottom = el.getBoundingClientRect().bottom
      const cap = sizing.maxHeight

      if (cap.kind === 'css') {
        setMaxHeightPx(parseCssLength(cap.value, window.innerHeight))
        return
      }

      if (cap.kind === 'viewport-offset') {
        setMaxHeightPx(Math.max(0, chatBottom - cap.topOffsetPx))
        return
      }

      const anchor = cap.ref.current
      if (!anchor) {
        setMaxHeightPx(Math.max(0, chatBottom))
        return
      }
      const anchorBottom = anchor.getBoundingClientRect().bottom
      setMaxHeightPx(Math.max(0, chatBottom - (anchorBottom + (cap.gapPx ?? 0))))
    }

    const ro = new ResizeObserver(recompute)
    ro.observe(el)

    let anchorRo: ResizeObserver | null = null
    if (sizing.maxHeight.kind === 'element-offset' && sizing.maxHeight.ref.current) {
      anchorRo = new ResizeObserver(recompute)
      anchorRo.observe(sizing.maxHeight.ref.current)
    }

    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, { passive: true })

    recompute()

    return () => {
      ro.disconnect()
      anchorRo?.disconnect()
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute)
      el.classList.remove(HUGGING_CLASS)
      parent?.classList.remove(HUGGING_CLASS)
    }
  }, [isHugging, sizing])

  if (!isHugging) {
    return { ref, style: {} }
  }

  return {
    ref,
    style: maxHeightPx == null ? {} : { maxHeight: `${maxHeightPx}px` },
  }
}

function parseCssLength(value: string, viewportHeight: number): number {
  const trimmed = value.trim()
  const match = trimmed.match(/^(-?\d*\.?\d+)\s*(px|vh)?$/i)
  if (!match) return 0
  const num = parseFloat(match[1] ?? '0')
  const unit = (match[2] ?? 'px').toLowerCase()
  if (unit === 'vh') return (num / 100) * viewportHeight
  return num
}
