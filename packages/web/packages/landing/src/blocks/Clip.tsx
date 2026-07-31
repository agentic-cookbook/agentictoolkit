'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * The server has no OS to ask, so it assumes motion is fine — and the client's
 * very first, pre-hydration render has to start from that same assumption, or
 * server and client disagree and React throws a hydration mismatch. Returning
 * `false` here is what makes that assumption explicit rather than accidental.
 */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Live `prefers-reduced-motion`, hydration-safe: `false` on the server and on
 * the first client render, corrected the instant `matchMedia` can be called,
 * and kept current if the reader changes the OS setting with the page open.
 *
 * Exported because the CSS kill-switch cannot reach everything — a host driving
 * its own `<video>`, or an animation library that writes transforms on its own
 * ticker, needs the value in JavaScript.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export interface ClipProps {
  /** Public path to an `.mp4`/`.webm`. */
  src: string
  /** Intrinsic size, so the frame reserves the right box before it loads. */
  width?: number
  height?: number
  /** Accessible name — usually the same words as the enclosing `Shot`'s caption. */
  label: string
}

/**
 * An auto-playing clip that actually honours `prefers-reduced-motion`: paused,
 * unlooped and given controls when the reader has asked for less motion.
 *
 * This exists as a component rather than as advice in a doc comment because
 * getting it right takes two cooperating halves, and a host that implements
 * only the obvious one ships a clip that plays anyway:
 *
 *  - `autoPlay={!reduced}` alone is not enough. The server always renders the
 *    attribute (it has no OS setting to consult), so on a slow-JS load the
 *    browser can begin playing straight from the raw HTML before React
 *    re-renders — and turning `autoPlay` off after playback has started does
 *    not stop it. The effect below force-pauses instead of trusting markup.
 *  - Reading the preference during render has to go through
 *    `usePrefersReducedMotion`, whose server snapshot assumes motion is fine,
 *    or the corrected client value mismatches the server HTML at hydration.
 *
 * Pass it as a `Shot`'s `media` to get the window frame around it; `.lp-shot
 * video` in the package CSS is what sizes it there.
 */
export function Clip({ src, width, height, label }: ClipProps): ReactElement {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (reduced) ref.current?.pause()
  }, [reduced])

  return (
    <video
      ref={ref}
      src={src}
      width={width}
      height={height}
      aria-label={label}
      muted
      playsInline
      autoPlay={!reduced}
      loop={!reduced}
      controls={reduced}
    />
  )
}
