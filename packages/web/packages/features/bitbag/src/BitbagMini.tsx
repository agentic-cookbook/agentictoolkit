'use client'

import type { CSSProperties } from 'react'
import { Bitbag, type BitbagExpression } from './avatar'

export interface BitbagMiniProps {
  /**
   * Pixel width of the mini. bitbag's face is width-driven (his SVG fills its
   * box), so this one knob sizes him. Default 112 — a compact badge.
   */
  size?: number
  /**
   * His pinned resting mood. Default 'idle' keeps him calm but alert — still
   * blinking, breathing, and following your cursor — rather than driven by a
   * chat. Pass another expression to freeze him in that pose.
   */
  expression?: BitbagExpression
  /**
   * When set, the badge becomes a link to this URL, opened in a new tab — the
   * way a small avatar links back to its full self. Omit for a bare mini.
   */
  href?: string
  /** Accessible label for the link. Only used when `href` is set. */
  label?: string
  /** Extra classes on the outer element — margins, responsive width, flex fit. */
  className?: string
}

/**
 * bitbag in miniature: a small, muted, idle bitbag to drop into a corner of any
 * site — a "who's here" badge, or a link back to his full self. He is the same
 * live avatar (he blinks, breathes, and follows your cursor), just pinned calm
 * and silent. Give him an `href` and he becomes a link, like olylo's own mini.
 */
export function BitbagMini({
  size = 112,
  expression = 'idle',
  href,
  label,
  className,
}: BitbagMiniProps) {
  // He is muted here: a badge has nowhere to put a speech bubble, and no
  // `onSpeak` is wired, so his chatter would land nowhere anyway.
  const avatar = <Bitbag expression={expression} mute />

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
        // display:block so the width takes hold on the otherwise-inline anchor.
        style={{ width: size, display: 'block' } satisfies CSSProperties}
      >
        {avatar}
      </a>
    )
  }

  return (
    <div className={className} style={{ width: size }}>
      {avatar}
    </div>
  )
}
