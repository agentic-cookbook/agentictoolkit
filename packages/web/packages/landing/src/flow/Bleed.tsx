import type { ReactElement, ReactNode } from 'react'

/**
 * Runs a child past the content column toward one page edge, so a window frame
 * is cropped by the viewport instead of sitting politely inside the measure.
 *
 * The crop is what sells it as a window onto something larger — a frame with
 * air on both sides reads as a picture of an app, and a frame the page edge
 * cuts reads as the app. It is `margin`, not `transform`: the neighbouring
 * column has to give up the space, which a transform would not make it do.
 *
 * Only meaningful inside `.lp-band`, whose `overflow-x: clip` is what stops the
 * overhang widening the document.
 */
export function Bleed({
  side = 'right',
  children,
  className,
}: {
  side?: 'left' | 'right'
  children: ReactNode
  className?: string
}): ReactElement {
  return <div className={['lp-bleed', `lp-bleed--${side}`, className].filter(Boolean).join(' ')}>{children}</div>
}
