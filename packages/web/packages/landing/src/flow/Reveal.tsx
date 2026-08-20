'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

/**
 * Fades and lifts its child into place as it enters the viewport.
 *
 * The resting state is the VISIBLE one, and the hidden state is added by this
 * component after mount (`armed`). That ordering is the whole accessibility
 * story: a reader with JavaScript off, or a crawler, or anyone whose observer
 * never fires, gets the finished page rather than an empty one. An animation
 * that hides content by default is a content-loss bug wearing a transition.
 *
 * `prefers-reduced-motion` is handled in CSS rather than here — the media query
 * in flow.css neutralises the transform and the transition, so this still
 * arms and still unarms, and the element simply appears. Reading the preference
 * in JS would mean a second source of truth that can disagree with the sheet.
 *
 * The observer disconnects on first intersection: a reveal is a one-way trip,
 * and re-hiding content the reader has scrolled back past is a well-known way
 * to make a page feel broken.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el === null) return
    // Anything already on screen at mount is never "revealed" — arming it would
    // blank content the reader is looking at, for one frame, on every load.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setShown(true)
      return
    }
    setArmed(true)
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const cls = ['lp-reveal', armed && !shown ? 'lp-reveal--armed' : '', className].filter(Boolean).join(' ')
  return (
    <div ref={ref} className={cls}>
      {children}
    </div>
  )
}
