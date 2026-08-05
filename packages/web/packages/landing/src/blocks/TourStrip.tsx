import type { ReactElement, ReactNode } from 'react'
import { Screen } from '../deck/Screen'
import { Wrap } from '../deck/Wrap'

export interface TourStep {
  href: string
  label: string
  /** A clause under the label — what the reader gets by following it. */
  note?: string
}

export interface TourPillar {
  title: string
  body: string
}

export interface TourStripProps {
  eyebrow: string
  promise: ReactNode
  position: { step: number; total: number }
  /** The masterbrand's three columns. Omitted on a leaf site. */
  pillars?: TourPillar[]
  back?: TourStep
  next?: TourStep
}

/**
 * The screen that opens a tour stop. It is a block rather than site chrome
 * because only `/tour` renders it — the site's own `/` is the deck and
 * nothing else.
 *
 * It is the FIRST screen, ahead of the hero: a reader arriving mid-walk needs
 * to know where they are before they read the site's pitch, and every screen
 * in this deck is a full viewport, so anything below this one is off screen on
 * arrival. Placed after the hero, a tour stop looked exactly like the site's
 * own front page until the reader happened to scroll. The reader who wants the
 * site rather than the tour is one flick from the hero.
 *
 * Both edges come from the walk, so the last stop has no `next` and the first
 * has no `back`, and neither renders a dead control.
 */
export function TourStrip({
  eyebrow,
  promise,
  position,
  pillars,
  back,
  next,
}: TourStripProps): ReactElement {
  const { step, total } = position
  return (
    <Screen id="tour" className="lp-tour">
      <Wrap>
        <span className="lp-eyebrow">{`Step ${step} of ${total} · ${eyebrow}`}</span>
        <p className="lp-tour__promise">{promise}</p>

        {pillars !== undefined && pillars.length > 0 && (
          <div className="lp-tour__pillars">
            {pillars.map((p) => (
              <div key={p.title} className="lp-card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="lp-tour__steps">
          {back !== undefined && (
            <a className="lp-tour__step lp-tour__step--back" href={back.href}>
              <span className="lp-tour__arrow" aria-hidden="true">←</span>
              <b>{back.label}</b>
              {back.note !== undefined && <em>{back.note}</em>}
            </a>
          )}
          {next !== undefined && (
            <a className="lp-tour__step lp-tour__step--next" href={next.href}>
              <b>{next.label}</b>
              {next.note !== undefined && <em>{next.note}</em>}
              <span className="lp-tour__arrow" aria-hidden="true">→</span>
            </a>
          )}
        </div>
      </Wrap>
    </Screen>
  )
}
