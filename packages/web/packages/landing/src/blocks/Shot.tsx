import type { ReactElement, ReactNode } from 'react'

export interface ShotProps {
  /** Window title drawn in the frame's title bar. */
  title: string
  /** What this shot will show. Rendered as the placeholder caption; if the
   *  host's `media` needs alt/aria text, the host is responsible for wiring
   *  this same string onto it. */
  caption: string
  /**
   * The status line above the caption in the placeholder — "Screenshot
   * pending", or whatever this host calls it. No default: it is visible copy,
   * and the package renders no word the host did not choose. Omitted, the
   * placeholder is just its caption, still obviously unfinished from the
   * hatching `.lp-shot__placeholder` draws.
   */
  pendingLabel?: ReactNode
  /**
   * A `<video>`, an `<img>`, whatever the host has. Absent renders the
   * placeholder frame — deliberately, obviously unfinished, so one shipped by
   * accident is caught rather than mistaken for a screenshot of a product
   * that looks like that.
   *
   * The package renders `media` exactly as given and does nothing else to it:
   * no asset pipeline, no motion handling. For a clip, pass this package's
   * `Clip` (from `@agentic-toolkit/landing/client`) rather than a bare
   * `<video>` — honouring `prefers-reduced-motion` on an autoplaying video
   * takes two cooperating halves, and `Clip` is where both live and where the
   * reasoning for them is written down. A host driving its own element can
   * take just the hook, `usePrefersReducedMotion`, from the same entry.
   */
  media?: ReactNode
}

/**
 * A macOS window frame around a screenshot or clip — or, absent `media`, an
 * obviously unfinished placeholder naming what belongs there. The placeholder
 * is the primary state: until a real capture exists, every feature section
 * renders one. Nothing else in this package imitates a window.
 */
export function Shot({ title, caption, pendingLabel, media }: ShotProps): ReactElement {
  return (
    <div className="lp-shot">
      <div className="lp-shot__bar">
        <span className="lp-shot__dot" />
        <span className="lp-shot__dot" />
        <span className="lp-shot__dot" />
        <span className="lp-shot__name">{title}</span>
      </div>
      {media === undefined ? (
        <div className="lp-shot__placeholder">
          {pendingLabel}
          <b>{caption}</b>
        </div>
      ) : (
        media
      )}
    </div>
  )
}
