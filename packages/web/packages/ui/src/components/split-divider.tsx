"use client"

import * as React from "react"

import { cn } from "../lib/utils"

/**
 * The bare horizontal split-SEPARATOR primitive: a draggable + keyboard-operable
 * `role="separator"` that reports a new top/bottom RATIO (0…1, the fraction of the
 * split height given to the pane ABOVE it). It owns NO panes and NO collapse state —
 * the caller renders the regions and applies the ratio (e.g. @adh-shared/search's
 * result-list / preview-dock stack).
 *
 * Relationship to {@link ResizableSplit}: ResizableSplit is the MANAGED two-pane
 * composite (it owns its top/bottom regions, localStorage persistence, and a
 * bottom-pane collapse toggle); SplitDivider is the underlying separator affordance
 * for callers that need to own their own layout and collapse semantics. Unifying
 * ResizableSplit on top of this primitive is future work.
 *
 * Accessibility: `role="separator"` with `aria-orientation="horizontal"` and
 * `aria-valuenow/min/max` (percent of the split given to the top pane),
 * `tabIndex={0}`, and ArrowUp/ArrowDown (± step) plus Home/End (min/max) keyboard
 * resizing. Pointer drag is tracked against the container rect via pointer capture;
 * a lost/cancelled capture or a move with the primary button already released ends
 * the drag (no resize-with-button-up). The step buttons are a single-pointer,
 * NON-drag resize alternative (WCAG 2.2 SC 2.5.7, Dragging Movements). The whole
 * row is 24px tall — the drag target and the 24px step buttons are fully contained
 * (WCAG 2.2 SC 2.5.8, Target Size, Minimum) with no bleed into adjacent panes.
 * apt-* tokens only.
 */
export interface SplitDividerProps {
  /** Current top-pane ratio (0…1) — the fraction of the split height above the divider. */
  ratio: number
  /** Report a new (clamped to min/max) ratio. */
  onRatioChange: (ratio: number) => void
  /** Min top-pane ratio (default 0.2). */
  minRatio?: number
  /** Max top-pane ratio (default 0.8). */
  maxRatio?: number
  /** Keyboard/step-button step per press (default 0.03). */
  step?: number
  /** The split container to measure pointer drags against. */
  containerRef: React.RefObject<HTMLElement | null>
  /** Accessible label for the separator. */
  label?: string
  /** Accessible label for the ▲ step button (shrinks the TOP pane by one step). */
  growBottomLabel?: string
  /** Accessible label for the ▼ step button (grows the TOP pane by one step). */
  growTopLabel?: string
  /** Extra classes on the root row. */
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function SplitDivider({
  ratio,
  onRatioChange,
  minRatio = 0.2,
  maxRatio = 0.8,
  step = 0.03,
  containerRef,
  label = "Resize split",
  growBottomLabel = "Grow bottom pane",
  growTopLabel = "Grow top pane",
  className,
}: SplitDividerProps): React.ReactElement {
  const dragging = React.useRef(false)

  const commit = React.useCallback(
    (next: number): void => onRatioChange(clamp(next, minRatio, maxRatio)),
    [onRatioChange, minRatio, maxRatio],
  )

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      dragging.current = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [],
  )

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!dragging.current) return
      // Robustness: if the primary button is no longer down (the pointerup landed
      // elsewhere, or capture was silently dropped), END the drag instead of
      // resizing with the button up.
      if ((event.buttons & 1) === 0) {
        dragging.current = false
        return
      }
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || rect.height === 0) return
      commit((event.clientY - rect.top) / rect.height)
    },
    [commit, containerRef],
  )

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      dragging.current = false
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    },
    [],
  )

  // A cancelled gesture (touch scroll takeover, window blur…) or lost capture must
  // end the drag too — otherwise the next stray pointermove resumes resizing.
  const onPointerAbort = React.useCallback((): void => {
    dragging.current = false
  }, [])

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault()
          commit(ratio - step)
          break
        case "ArrowDown":
          event.preventDefault()
          commit(ratio + step)
          break
        case "Home":
          event.preventDefault()
          commit(minRatio)
          break
        case "End":
          event.preventDefault()
          commit(maxRatio)
          break
      }
    },
    [commit, ratio, step, minRatio, maxRatio],
  )

  const growBottom = React.useCallback((): void => commit(ratio - step), [commit, ratio, step])
  const growTop = React.useCallback((): void => commit(ratio + step), [commit, ratio, step])

  return (
    // The row is 24px tall (h-6): the WHOLE row is the drag target (≥24 CSS px, WCAG
    // 2.2 SC 2.5.8) with the thin visual line centred in it, and the 24px step
    // buttons are fully contained — nothing bleeds into the panes above/below.
    <div className={cn("relative flex h-6 shrink-0 items-center", className)}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerAbort}
        onLostPointerCapture={onPointerAbort}
        onKeyDown={onKeyDown}
        className="group flex h-full w-full cursor-row-resize touch-none select-none items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40"
      >
        {/* The thin visual line, centred in the 24px grab row. */}
        <span
          aria-hidden
          className="pointer-events-none h-[3px] w-full rounded-full bg-apt-border transition-colors group-hover:bg-apt-border-strong group-focus-visible:bg-apt-border-strong"
        />
      </div>
      {/* WCAG 2.2 SC 2.5.7 (Dragging Movements): a single-pointer, NON-drag resize
          alternative — step buttons nudge the split by one step on click/tap, so a
          pointer user who can't perform a sustained drag can still resize. They are
          SIBLINGS of the separator (a button inside role="separator" would be invalid
          ARIA), sized 24px to also meet SC 2.5.8, and fully contained in the 24px row. */}
      <div className="pointer-events-none absolute inset-y-0 right-1 z-10 flex items-center gap-2">
        <button
          type="button"
          aria-label={growBottomLabel}
          onClick={growBottom}
          className="pointer-events-auto flex size-6 items-center justify-center rounded text-[10px] leading-none text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
        >
          <span aria-hidden>▲</span>
        </button>
        <button
          type="button"
          aria-label={growTopLabel}
          onClick={growTop}
          className="pointer-events-auto flex size-6 items-center justify-center rounded text-[10px] leading-none text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
        >
          <span aria-hidden>▼</span>
        </button>
      </div>
    </div>
  )
}
