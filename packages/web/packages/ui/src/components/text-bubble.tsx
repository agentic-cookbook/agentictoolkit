'use client'

import { createElement, useEffect, useRef, type CSSProperties, type JSX, type ReactElement, type RefObject } from 'react'

/**
 * A traveling "distortion lens" that rides over an element's text, character by
 * character in reading order, then restarts at the beginning (a forward loop).
 * Ported from the distortion bubble on mikefullerton.com.
 *
 * Each glyph within the lens is magnified, faintly blurred, and colour-shifted
 * from `colorFrom` toward `colorTo` (via `color-mix`) — together reading as a
 * soft moving lens. The travel follows the element's resolved text `direction`:
 * left-to-right per line for `ltr`, right-to-left for `rtl`.
 *
 * Cosmetic only: the original text is restored on cleanup and an off-screen copy
 * keeps the full string available to assistive tech, so markup stays crawlable
 * and accessible. Set `active` false to leave the text untouched (e.g. while
 * hidden, or when the visitor prefers reduced motion).
 */
export interface TextBubbleOptions {
  /** Run the lens. When false the element keeps its plain, un-split text. */
  active: boolean
  /** Re-split + re-measure when this changes (default: the text itself). */
  resetKey?: string | number
  /** Glyph colour at the lens edge (default: the element's own `currentColor`). */
  colorFrom?: string
  /** Glyph colour at the lens centre (default: `currentColor` — no colour shift). */
  colorTo?: string
  /** Lens influence radius in px (default 44). */
  radius?: number
  /** Extra scale at the lens centre, 1 → 1+maxScale (default 0.18). */
  maxScale?: number
  /** Blur in px at the lens centre (default 0.4). */
  maxBlur?: number
  /** Travel speed: ms the lens spends per glyph (default 48). */
  msPerChar?: number
  /** Floor so short strings don't whip past (default 4500). */
  minDuration?: number
  /** Idle hold (ms) BEFORE each sweep: the lens parks (text plain) for this long,
   *  sweeps once, parks again, and repeats. The first hold is the start delay; the
   *  holds between sweeps are the loop pause. Default 0 → a continuous forward loop. */
  pauseMs?: number
}

interface Glyph {
  el: HTMLSpanElement
  cx: number
  cy: number
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

// Scripts whose letters join cursively can't be split into per-character spans
// without breaking their shaping (the letters stop joining). The lens skips text
// containing them and leaves it rendered normally. Non-joining RTL scripts (e.g.
// Hebrew) are unaffected and still animate, right-to-left.
const CURSIVE_SCRIPT =
  /\p{Script=Arabic}|\p{Script=Syriac}|\p{Script=Mongolian}|\p{Script=Nko}|\p{Script=Mandaic}|\p{Script=Adlam}/u

// Order glyphs into visual reading order: top-to-bottom by line, then along each
// line in the text direction (left-to-right for ltr, right-to-left for rtl).
function readingOrder(glyphs: Glyph[], rtl: boolean): Glyph[] {
  const sign = rtl ? -1 : 1
  return [...glyphs].sort((a, b) => a.cy - b.cy || sign * (a.cx - b.cx))
}

export function useTextBubble<T extends HTMLElement = HTMLElement>(
  options: TextBubbleOptions,
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const {
    active,
    resetKey,
    colorFrom = 'currentColor',
    colorTo = 'currentColor',
    radius = 44,
    maxScale = 0.18,
    maxBlur = 0.4,
    msPerChar = 48,
    minDuration = 4500,
    pauseMs = 0,
  } = options

  useEffect(() => {
    const host = ref.current
    if (!host || !active) return

    const original = host.textContent ?? ''
    if (!original.trim()) return
    // Per-character splitting would break cursive shaping — leave such text alone.
    if (CURSIVE_SCRIPT.test(original)) return

    // Build two copies inside the host:
    //  • an off-screen text copy read by assistive tech, and
    //  • a visible, animated copy split into per-character spans (aria-hidden).
    // Whole words are wrapped in inline-block/nowrap spans so a line only ever
    // breaks between words; splitting bare characters would let a line break
    // mid-word. The whitespace between words stays plain text — the break points.
    // Each character must be inline-block for `transform` to apply; that transform
    // is visual-only, so it never reflows neighbours and no width pinning is needed.
    const sr = document.createElement('span')
    sr.textContent = original
    sr.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0'

    const visual = document.createElement('span')
    visual.setAttribute('aria-hidden', 'true')
    const spans: HTMLSpanElement[] = []
    for (const part of original.split(/(\s+)/)) {
      if (part === '') continue
      if (/\s/.test(part)) {
        visual.appendChild(document.createTextNode(part))
        continue
      }
      const word = document.createElement('span')
      word.style.display = 'inline-block'
      word.style.whiteSpace = 'nowrap'
      for (const ch of part) {
        const glyph = document.createElement('span')
        glyph.textContent = ch
        glyph.style.display = 'inline-block'
        word.appendChild(glyph)
        spans.push(glyph)
      }
      visual.appendChild(word)
    }
    host.textContent = ''
    host.append(sr, visual)

    // Measure in layout space (offsetLeft/Top), which — unlike getBoundingClientRect
    // — ignores any entrance/scale transform on an ancestor, so the lens never
    // desyncs from the glyphs while the host is still animating in.
    function measure(): Glyph[] {
      return spans.map((el) => ({
        el,
        cx: el.offsetLeft + el.offsetWidth / 2,
        cy: el.offsetTop + el.offsetHeight / 2,
      }))
    }
    const isRtl = () => getComputedStyle(host).direction === 'rtl'
    let glyphs = measure()
    let path = readingOrder(glyphs, isRtl())
    if (path.length === 0) {
      host.textContent = original
      return
    }

    const duration = Math.max(minDuration, original.length * msPerChar)
    // One cycle = a pauseMs idle HOLD then a sweep. The first hold is the start delay;
    // the holds between sweeps are the loop pause (both = pauseMs).
    const cycleLen = duration + pauseMs
    const radiusSq = radius * radius // cull by squared distance — no sqrt for far glyphs
    const start = performance.now() // same time origin as the rAF timestamp
    let raf = 0

    function clearGlyphs(): void {
      for (const gph of glyphs) {
        const style = gph.el.style
        if (style.transform) {
          style.transform = ''
          style.filter = ''
          style.color = ''
          style.willChange = ''
        }
      }
    }

    function frame(now: number): void {
      const tInCycle = (now - start) % cycleLen
      if (tInCycle < pauseMs) {
        // idle hold — leave the text plain (start delay / between-loop pause)
        clearGlyphs()
        raf = requestAnimationFrame(frame)
        return
      }
      const p = (tInCycle - pauseMs) / duration // 0 → 1 across the sweep
      // Glide the lens centre along the polyline of glyph centres in reading
      // order, so it follows the text and sweeps to the next line at each wrap.
      const f = p * (path.length - 1)
      const i = Math.floor(f)
      const frac = f - i
      const a = path[i]
      const b = path[Math.min(i + 1, path.length - 1)]
      if (!a || !b) {
        raf = requestAnimationFrame(frame)
        return
      }
      const bx = a.cx + (b.cx - a.cx) * frac
      const by = a.cy + (b.cy - a.cy) * frac

      for (const gph of glyphs) {
        const dx = gph.cx - bx
        const dy = gph.cy - by
        const distSq = dx * dx + dy * dy
        const style = gph.el.style
        if (distSq > radiusSq) {
          if (style.transform) {
            style.transform = ''
            style.filter = ''
            style.color = ''
            // Drop the compositor hint once the glyph leaves the lens, so only the
            // handful of glyphs under the lens are ever promoted — not all of them.
            style.willChange = ''
          }
          continue
        }
        style.willChange = 'transform, filter, color'
        const t = smoothstep(1 - Math.sqrt(distSq) / radius)
        style.transform = `scale(${(1 + t * maxScale).toFixed(3)})`
        const blur = t * maxBlur
        style.filter = blur > 0.03 ? `blur(${blur.toFixed(2)}px)` : ''
        style.color = `color-mix(in oklab, ${colorFrom}, ${colorTo} ${Math.round(t * 100)}%)`
      }
      raf = requestAnimationFrame(frame)
    }

    // Re-measure (and re-read direction) when the host rewraps on resize.
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        glyphs = measure()
        path = readingOrder(glyphs, isRtl())
      })
      observer.observe(host)
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      host.textContent = original
    }
  }, [active, resetKey, colorFrom, colorTo, radius, maxScale, maxBlur, msPerChar, minDuration, pauseMs])

  return ref
}

export type TextBubbleProps = TextBubbleOptions & {
  /** The text the lens rides over. */
  text: string
  /** Intrinsic element to render (default `p`); must be a real DOM element so the
   *  lens can attach its ref. */
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
}

/**
 * Renders `text` in the given element and runs the traveling-lens effect over it.
 * The text renders as plain content first (crawlable, accessible) and is only
 * split into animated spans while `active`.
 */
export function TextBubble({
  text,
  as = 'p',
  className,
  style,
  ...options
}: TextBubbleProps): ReactElement {
  const resetKey = options.resetKey ?? text
  const ref = useTextBubble<HTMLElement>({ ...options, resetKey })
  // Key by resetKey so a text/version change remounts the element. The hook
  // splits the element's children imperatively; remounting hands React a fresh
  // node to own instead of reconciling a new `text` against spans it didn't
  // create (which would leave the old, already-split text on screen).
  return createElement(as, { key: resetKey, ref, className, style }, text)
}
