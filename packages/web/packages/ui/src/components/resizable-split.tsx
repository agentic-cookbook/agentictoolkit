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

  const [ratio, setRatio] = React.useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : NaN
      if (!Number.isNaN(n)) return clamp(n)
    }
    return clamp(defaultRatio)
  })

  const [internalCollapsed, setInternalCollapsed] = React.useState(false)
  const isCollapsed = collapsed ?? internalCollapsed

  function updateRatio(next: number): void {
    const c = clamp(next)
    setRatio(c)
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, String(c))
    }
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
  }

  function onHandleKey(e: React.KeyboardEvent): void {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      updateRatio(ratio - 0.03)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      updateRatio(ratio + 0.03)
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
      {/* Divider: a thin 5px visual line, but a TALLER (12px) transparent grab zone
          so it's easy to drag. The chevron toggles collapse; its `stopPropagation`
          keeps it from hijacking a drag started on the strip. */}
      <div
        className="group relative flex h-3 shrink-0 items-center justify-center"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onKeyDown={onHandleKey}
        style={{ cursor: isCollapsed ? "default" : "row-resize" }}
        onPointerDown={isCollapsed ? undefined : onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 bg-apt-border group-hover:bg-apt-border-strong" />
        <button
          type="button"
          aria-label={bottomLabel}
          aria-expanded={!isCollapsed}
          onClick={() => {
            // A drag that passed over the chevron must not also toggle collapse.
            if (moved.current) return
            setCollapsed(!isCollapsed)
          }}
          className="relative rounded bg-apt-surface px-1 text-apt-text-muted hover:text-apt-text"
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
