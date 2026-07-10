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
  /**
   * Render the divider as the bottom pane's HEADER BAR — a real strip (always
   * visible, including while the pane is hidden) whose left side shows this
   * content (typically the pane's title). The whole bar is a drag target
   * (`row-resize` cursor); the disclosure chevron sits at its far right.
   * Omit for the classic 1px seam divider.
   */
  header?: React.ReactNode
  /** Right-aligned controls on the header bar, before the disclosure chevron.
   *  Interactive elements here never start a drag. */
  headerActions?: React.ReactNode
  /**
   * On expand-from-collapsed, size the bottom pane to show ALL its content
   * (clamped to the ratio bounds) instead of restoring the last drag ratio.
   * Defaults to on for the header-bar variant, off for the seam.
   */
  expandToContent?: boolean
  className?: string
}

export const TOGGLE_ANIMATION_MS = 300

/**
 * The top-pane ratio that reveals the whole bottom content, clamped to the drag
 * bounds — or `fallback` (the last drag ratio) when the container/content can't
 * be measured (zero heights, jsdom).
 */
export function revealRatioForContent(
  containerH: number,
  barH: number,
  contentH: number,
  minRatio: number,
  maxRatio: number,
  fallback: number,
): number {
  if (containerH <= 0 || contentH <= 0) return fallback
  const desired = 1 - (contentH + barH) / containerH
  return Math.min(maxRatio, Math.max(minRatio, desired))
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
  header,
  headerActions,
  expandToContent,
  className,
}: ResizableSplitProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const barRef = React.useRef<HTMLDivElement>(null)
  const bottomInnerRef = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)
  const moved = React.useRef(false)
  const startY = React.useRef(0)

  const isHeaderBar = header !== undefined || headerActions !== undefined
  const sizeToContent = expandToContent ?? isHeaderBar

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

  // Hide/show animates the top pane's flex-basis; armed per-toggle so a drag is
  // never animated. Gated on the app-level appearance setting
  // (`html[data-reduce-motion="on"]` — the toolkit themes' reduce-motion pref),
  // NOT the OS `prefers-reduced-motion` media query: sites that import the
  // themes' accessibility.css get the media-query gating from there.
  const [animating, setAnimating] = React.useState(false)
  const animTimer = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(animTimer.current), [])

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

  function toggleCollapsed(): void {
    const next = !isCollapsed
    if (!next && sizeToContent) {
      // Reveal-to-fit: measure the hidden content (scrollHeight survives a
      // zero-height pane) and open exactly far enough to show all of it.
      const containerH = containerRef.current?.getBoundingClientRect().height ?? 0
      const barH = barRef.current?.offsetHeight ?? 0
      const contentH = bottomInnerRef.current?.scrollHeight ?? 0
      const r = revealRatioForContent(containerH, barH, contentH, minRatio, maxRatio, latest.current)
      latest.current = r
      setRatio(r)
      persist()
    }
    const reduceMotion =
      typeof document !== "undefined" && document.documentElement.dataset.reduceMotion === "on"
    if (!reduceMotion) {
      setAnimating(true)
      window.clearTimeout(animTimer.current)
      animTimer.current = window.setTimeout(() => setAnimating(false), TOGGLE_ANIMATION_MS + 30)
    }
    setCollapsed(next)
  }

  function onPointerDown(e: React.PointerEvent): void {
    dragging.current = true
    moved.current = false
    startY.current = e.clientY
    setAnimating(false) // a drag is direct manipulation — never animated
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  /** Header-bar drag entry: anywhere on the bar starts a resize EXCEPT on its
   *  interactive controls (chevron, header actions). */
  function onBarPointerDown(e: React.PointerEvent): void {
    if (isCollapsed) return
    // Any fresh press clears the drag-passed-over flag — including presses on the
    // chevron, which early-return below and would otherwise inherit a stale
    // `moved` from the PREVIOUS drag and have their click swallowed.
    moved.current = false
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [data-no-drag]")) return
    onPointerDown(e)
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
    if (isCollapsed) return
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

  const separatorAria = {
    role: "separator" as const,
    "aria-orientation": "horizontal" as const,
    "aria-valuenow": Math.round(ratio * 100),
    "aria-valuemin": Math.round(minRatio * 100),
    "aria-valuemax": Math.round(maxRatio * 100),
  }

  const chevron = (
    <button
      type="button"
      aria-label={bottomLabel}
      aria-expanded={!isCollapsed}
      onClick={() => {
        // A drag that passed over the chevron must not also toggle collapse.
        if (moved.current) return
        toggleCollapsed()
      }}
      className={cn(
        "rounded px-1 text-apt-text-muted hover:text-apt-text",
        isHeaderBar ? "relative shrink-0 cursor-pointer py-0.5" : "absolute right-1 top-1/2 -translate-y-1/2 bg-apt-surface",
      )}
    >
      {isCollapsed ? <ChevronUp size={isHeaderBar ? 14 : 12} /> : <ChevronDown size={isHeaderBar ? 14 : 12} />}
    </button>
  )

  return (
    <div ref={containerRef} className={cn("flex min-h-0 flex-col", className)}>
      <div
        className="min-h-0 overflow-auto"
        style={{
          // shrink 1 lets the collapsed 100% basis give back the divider's own height
          flex: `0 1 ${(isCollapsed ? 1 : ratio) * 100}%`,
          transition: animating ? `flex-basis ${TOGGLE_ANIMATION_MS}ms ease-in-out` : undefined,
        }}
      >
        {top}
      </div>

      {isHeaderBar ? (
        /* Divider as the details pane's HEADER BAR: always visible (it IS the
           collapsed state's remnant), whole-bar drag target with a row-resize
           cursor, content left, actions + disclosure chevron right. */
        <div
          ref={barRef}
          {...separatorAria}
          tabIndex={0}
          onKeyDown={onHandleKey}
          className="group relative z-10 flex shrink-0 select-none items-center gap-2 border-y border-apt-border bg-apt-surface py-0.5 pl-2 pr-1"
          style={{ cursor: isCollapsed ? "default" : "row-resize", touchAction: "none" }}
          onPointerDown={onBarPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wide text-apt-text-muted">
            {header}
          </div>
          {headerActions}
          {chevron}
        </div>
      ) : (
        /* Divider: a 1px seam so the bottom of `top` and the top of `bottom` are
           CONNECTED (no gap) — dragging it moves that shared boundary. A generous
           (24px) transparent overlay centered on the seam carries the drag, so
           grabbing NEAR the boundary (the bottom of `top` / the top of `bottom`),
           not just the hairline, starts the resize; `z-10` lifts the whole divider
           above both panes so the entire band is grabbable. A visible grip pill
           advertises that the seam is draggable (a bare 1px line reads as inert);
           the collapse chevron sits at the right so it never covers the grip. The
           `moved` guard stops a drag from also toggling collapse. */
        <div
          ref={barRef}
          {...separatorAria}
          tabIndex={0}
          onKeyDown={onHandleKey}
          className="group relative z-10 h-px shrink-0"
        >
          {/* the seam line itself (fills the 1px divider), highlights on hover */}
          <div className="pointer-events-none absolute inset-0 bg-apt-border group-hover:bg-apt-border-strong" />
          {/* visible drag grip — a short centered bar signalling the seam is draggable */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-apt-border-strong opacity-70 group-hover:opacity-100" />
          {/* generous transparent grab band, centered on the seam */}
          <div
            className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2"
            style={{ cursor: isCollapsed ? "default" : "row-resize", touchAction: "none" }}
            onPointerDown={isCollapsed ? undefined : onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
          {chevron}
        </div>
      )}

      {/* The bottom pane stays MOUNTED while collapsed (height 0, clipped, inert):
          its state survives a hide/show cycle, the flex-basis animation has both
          endpoints, and reveal-to-fit can measure the hidden content. */}
      <div className="min-h-0 flex-1 overflow-hidden" inert={isCollapsed || undefined}>
        <div ref={bottomInnerRef} className="h-full overflow-auto">
          {bottom}
        </div>
      </div>
    </div>
  )
}
