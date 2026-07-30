import type { ReactElement } from 'react'

export type HubMarkProps = {
  /** Extra classes on the root svg (size/color it from the call site). */
  className?: string
}

/**
 * The hub brand mark, small-size cut for chrome (~18-40px): the four-point AI
 * sparkle at the MASTER waist (Bézier controls at dead center, the same curve
 * as the full-size mark) with four mini sparkles at the diagonal stations — the
 * family of sites around the hub. The corner minis leave the star's axes
 * free, so the star runs at full size and stays legible at header size.
 * This cut is transcribed by hand from the brand's vector masters, which ship
 * with the brand assets rather than with this package — keep the two in sync.
 *
 * Fills with `currentColor` so it rides the caller's text color — the header
 * trigger's accent (and its hover brightening), or a wordmark's own color —
 * never a hard-coded palette. Decorative: the brand NAME is always adjacent
 * text, so the mark itself stays hidden from assistive tech.
 */
export function HubMark({ className }: HubMarkProps): ReactElement {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M816,58 Q816,208 966,208 Q816,208 816,358 Q816,208 666,208 Q816,208 816,58 Z" />
      <path d="M816,666 Q816,816 966,816 Q816,816 816,966 Q816,816 666,816 Q816,816 816,666 Z" />
      <path d="M208,666 Q208,816 358,816 Q208,816 208,966 Q208,816 58,816 Q208,816 208,666 Z" />
      <path d="M208,58 Q208,208 358,208 Q208,208 208,358 Q208,208 58,208 Q208,208 208,58 Z" />
      <path d="M512,72 Q512,512 952,512 Q512,512 512,952 Q512,512 72,512 Q512,512 512,72 Z" />
    </svg>
  )
}
