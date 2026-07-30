import type { ReactElement, ReactNode } from 'react'

export interface ShotProps {
  /** Window title drawn in the frame's title bar. */
  title: string
  /** What this shot will show. Rendered as the placeholder caption; if the
   *  host's `media` needs alt/aria text, the host is responsible for wiring
   *  this same string onto it. */
  caption: string
  /**
   * A `<video>`, an `<img>`, whatever the host has. Absent renders the
   * placeholder frame — deliberately, obviously unfinished, so one shipped by
   * accident is caught rather than mistaken for a screenshot of a product
   * that looks like that.
   *
   * The package renders `media` exactly as given and does nothing else to
   * it — no asset pipeline, no motion handling. In particular, **honouring
   * `prefers-reduced-motion` on a `<video>` is the host's job now**, not this
   * component's. That used to live here, and the reasoning that earned it is
   * worth keeping even though the code moved:
   *
   * - The server has no OS setting to consult, so it always ships `autoplay`
   *   on the raw HTML. On a slow-JS load the browser can begin playing
   *   straight from that HTML before React ever re-renders — and turning
   *   `autoPlay` off after playback has already started does not stop it.
   *   So once the real preference is known, the fix has to force a pause
   *   explicitly rather than trust the attribute alone.
   * - The first read of that preference has to assume motion is fine on the
   *   server (there is no OS to ask), and the client's first, pre-hydration
   *   render has to start from that same assumption — otherwise server and
   *   client disagree and React throws a hydration mismatch. A
   *   `useSyncExternalStore` whose `getServerSnapshot` returns `false` is
   *   what makes that assumption explicit, then corrects to the live value
   *   the instant the client can call `matchMedia`.
   *
   * A host rendering a `<video>` into this prop needs both halves of that: an
   * effect that force-pauses it when reduced motion is preferred, and a
   * snapshot hook whose server value assumes motion is fine so hydration
   * doesn't mismatch.
   */
  media?: ReactNode
}

/**
 * A macOS window frame around a screenshot or clip — or, absent `media`, an
 * obviously unfinished placeholder naming what belongs there. The placeholder
 * is the primary state: until a real capture exists, every feature section
 * renders one. Nothing else in this package imitates a window.
 */
export function Shot({ title, caption, media }: ShotProps): ReactElement {
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
          Screenshot pending
          <b>{caption}</b>
        </div>
      ) : (
        media
      )}
    </div>
  )
}
