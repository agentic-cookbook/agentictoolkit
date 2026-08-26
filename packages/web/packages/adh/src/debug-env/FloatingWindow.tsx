'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { Button } from '@agenticdevelopertoolkit/ui/components/button'
import { useIsMounted } from '../hooks/useIsMounted'

// A macOS-style floating window: NO backdrop, so the live page stays visible behind
// it. Draggable by its title bar, resizable from the corner. Dismisses on Escape or the
// × button ONLY — clicking the page does NOT close it, so you can interact with the live
// page for preview while the window stays open. Portaled to <body> so nothing clips it.
//
// Size is UNCONTROLLED: the initial size is written to the element once (before paint)
// and `resize: both` owns it thereafter — React never re-applies width/height, so a
// user resize sticks across re-renders with no ResizeObserver and no per-frame churn.
// Only `pos` (drag) is React state.
export function FloatingWindow({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useIsMounted()
  const titleId = useId()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const initialSize = useRef<{ w: number; h: number } | null>(null)
  const dragTeardown = useRef<(() => void) | null>(null)

  // Centered placement + initial size each time it opens.
  useEffect(() => {
    if (!open) return
    const w = Math.min(1400, Math.round(window.innerWidth * 0.95))
    const h = Math.min(920, Math.round(window.innerHeight * 0.88))
    initialSize.current = { w, h }
    setPos({
      x: Math.round((window.innerWidth - w) / 2),
      y: Math.round((window.innerHeight - h) / 2),
    })
  }, [open])

  // Apply the initial size to the element ONCE, before paint (no flash). After this
  // the native corner resize owns width/height; we never set them via React style.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !initialSize.current) return
    el.style.width = `${initialSize.current.w}px`
    el.style.height = `${initialSize.current.h}px`
    initialSize.current = null
  })

  // Dismiss the window on Escape only (the × button is the other way out). Clicking the
  // page does NOT close it — there's no backdrop, so the page stays live for preview. An
  // overlay opened from INSIDE the window (e.g. the Site-theme "Unsaved changes" prompt, a
  // base-ui Dialog) is portaled to <body>; while one is open, that Escape belongs to IT,
  // not us, so we must not tear the whole window down underneath it (else the prompt closes
  // AND our onClose fires → a fresh guarded close-prompt double-fires). base-ui stamps an
  // OPEN popup with `[data-open]`; a modal dialog popup also carries `role="dialog"`. The
  // window itself is a plain `role="dialog"` div with NO `data-open`, so we detect a nested
  // overlay as any OPEN dialog popup other than us. We SAMPLE that in the capture phase
  // (before base-ui processes the key) and only close in the bubble phase if none was open —
  // and a child that owns the key (a nested overlay, or a Monaco widget) stops propagation
  // before the bubble fires.
  useEffect(() => {
    if (!open) return
    // A base-ui overlay popup (Dialog/Menu/Select/Popover) is portaled to <body> and marked
    // `[data-open]` while visible; the window is `role="dialog"` with no `data-open`.
    const nestedOverlayOpen = () => !!document.querySelector('[data-open][role="dialog"]')
    let escapeBelongedToNested = false
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escapeBelongedToNested = nestedOverlayOpen()
    }
    const onKeyBubble = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !escapeBelongedToNested) onClose()
    }
    window.addEventListener('keydown', onKeyCapture, true)
    window.addEventListener('keydown', onKeyBubble)
    return () => {
      window.removeEventListener('keydown', onKeyCapture, true)
      window.removeEventListener('keydown', onKeyBubble)
    }
  }, [open, onClose])

  // Tear down any in-flight drag listeners on unmount (e.g. closed mid-drag).
  useEffect(() => () => dragTeardown.current?.(), [])

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pos || e.button !== 0) return
      const startX = e.clientX
      const startY = e.clientY
      const origin = { ...pos }
      const move = (ev: PointerEvent) => {
        const w = ref.current?.offsetWidth ?? 0
        // Keep the title bar reachable (don't let the window escape entirely).
        setPos({
          x: Math.max(120 - w, Math.min(origin.x + (ev.clientX - startX), window.innerWidth - 120)),
          y: Math.max(0, Math.min(origin.y + (ev.clientY - startY), window.innerHeight - 44)),
        })
      }
      const teardown = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', teardown)
        dragTeardown.current = null
      }
      dragTeardown.current = teardown
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', teardown)
    },
    [pos],
  )

  if (!open || !mounted || !pos) return null

  // z-50 is the shared overlay tier (dialog/popover/dropdown all sit here). An overlay
  // opened from inside this window — e.g. the Site-theme "Unsaved changes" prompt, a
  // base-ui Dialog — is portaled to <body> at that same z-50, so it stacks above the
  // window by DOM order. An arbitrarily higher value (was z-[1000]) painted OVER those
  // overlays, hiding them behind the window while the modal trap blanked the rest of the
  // console — the popup looked dead. Stay in the tier.
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-apt-border bg-apt-surface text-apt-text shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        resize: 'both',
        minWidth: 520,
        minHeight: 360,
        maxWidth: '100vw',
        maxHeight: '100vh',
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        className="flex shrink-0 cursor-move select-none items-center justify-between border-b border-apt-border bg-apt-bg px-5 py-3"
      >
        <span id={titleId} className="font-mono text-sm text-apt-gold">
          {title}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          onClick={onClose}
          className="text-apt-text-muted hover:text-apt-text"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>,
    document.body,
  )
}
