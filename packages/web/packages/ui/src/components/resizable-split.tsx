"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "../lib/utils"

export interface ResizableSplitProps {
  top: React.ReactNode
  bottom: React.ReactNode
  defaultRatio?: number
  minRatio?: number
  maxRatio?: number
  storageKey?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  bottomLabel?: string
  className?: string
}

export function ResizableSplit({
  top,
  bottom,
  defaultRatio = 0.6,
  minRatio = 0.2,
  maxRatio = 0.85,
  storageKey,
  collapsed,
  onCollapsedChange,
  bottomLabel = "Details",
  className,
}: ResizableSplitProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)
  const moved = React.useRef(false)
  const startY = React.useRef(0)

  const clamp = (r: number): number => Math.min(maxRatio, Math.max(minRatio, r))

  // Start from the default so the server and the first client render agree — reading
  // localStorage during render caused an SSR hydration mismatch. The persisted ratio
  // is loaded post-mount in the effect below.
  const [ratio, setRatio] = React.useState<number>(() => clamp(defaultRatio))
  // Latest ratio tracked outside React state so a drag can persist ONCE on release
  // without threading the value through the pointerup event.
  const latest = React.useRef<number>(clamp(defaultRatio))

  // Load any persisted ratio after mount. Guarded: window.localStorage throws in
  // sandboxed iframes / disabled-storage contexts, where we keep the default.
  React.useEffect(() => {
    if (!storageKey) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : NaN
      if (!Number.isNaN(n)) {
        const v = clamp(n)
        latest.current = v
        setRatio(v)
      }
    } catch {
      // storage unavailable — keep the default ratio
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp bounds are effectively constant
  }, [storageKey])

  const [internalCollapsed, setInternalCollapsed] = React.useState(false)
  const isCollapsed = collapsed ?? internalCollapsed

  function persist(): void {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, String(latest.current))
    } catch {
      // storage unavailable — skip persistence
    }
  }

  function updateRatio(next: number): void {
    const c = clamp(next)
    latest.current = c
    setRatio(c) // live update only; persistence happens on drag-release / keyboard step
  }

  function setCollapsed(next: boolean): void {
    if (onCollapsedChange) {
      onCollapsedChange(next)
    } else {
      setInternalCollapsed(next)
    }
  }

  function onPointerDown(e: React.PointerEvent): void {
    dragging.current = true
    moved.current = false
    startY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent): void {
    if (isCollapsed) return
    if (!dragging.current || !containerRef.current) return
    if (Math.abs(e.clientY - startY.current) > 3) moved.current = true
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.height === 0) return
    updateRatio((e.clientY - rect.top) / rect.height)
  }

  function onPointerUp(e: React.PointerEvent): void {
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    persist() // persist once, on release — not per pointermove
  }

  function onHandleKey(e: React.KeyboardEvent): void {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      updateRatio(ratio - 0.03)
      persist()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      updateRatio(ratio + 0.03)
      persist()
    }
  }

  return (
    <div ref={containerRef} className={cn("flex min-h-0 flex-col", className)}>
      <div
        className="min-h-0 overflow-auto"
        style={{ flex: isCollapsed ? "1 1 auto" : `0 0 ${ratio * 100}%` }}
      >
        {top}
      </div>
      {/* Divider: a 1px seam so the bottom of `top` and the top of `bottom` are
          CONNECTED (no gap) — dragging it moves that shared boundary. A generous
          (24px) transparent overlay centered on the seam carries the drag, so
          grabbing NEAR the boundary (the bottom of `top` / the top of `bottom`),
          not just the hairline, starts the resize; `z-10` lifts the whole divider
          above both panes so the entire band is grabbable. A visible grip pill
          advertises that the seam is draggable (a bare 1px line reads as inert);
          the collapse chevron sits at the right so it never covers the grip. The
          `moved` guard stops a drag from also toggling collapse. */}
      <div
        className="group relative z-10 h-px shrink-0"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onKeyDown={onHandleKey}
      >
        {/* the seam line itself (fills the 1px divider), highlights on hover */}
        <div className="pointer-events-none absolute inset-0 bg-apt-border group-hover:bg-apt-border-strong" />
        {/* visible drag grip — a short centered bar signalling the seam is draggable */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-apt-border-strong opacity-70 group-hover:opacity-100" />
        {/* generous transparent grab band, centered on the seam */}
        <div
          className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2"
          style={{ cursor: isCollapsed ? "default" : "row-resize" }}
          onPointerDown={isCollapsed ? undefined : onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <button
          type="button"
          aria-label={bottomLabel}
          aria-expanded={!isCollapsed}
          onClick={() => {
            // A drag that passed over the chevron must not also toggle collapse.
            if (moved.current) return
            setCollapsed(!isCollapsed)
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-apt-surface px-1 text-apt-text-muted hover:text-apt-text"
        >
          {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="min-h-0 flex-1 overflow-auto">{bottom}</div>
      )}
    </div>
  )
}
