import type { ReactElement } from 'react';
import type { LandingContent } from './content';
export interface LandingDeckProps {
    content: LandingContent;
}
/**
 * A family site's `/` — the deck and nothing else.
 *
 * Every site in the family mounts this from the same `app/page.tsx`, byte for byte, and
 * hands it the content generated from its own markdown. Which is what makes the deck's
 * shape a single file: it used to be emitted per site, so a change to the structure meant
 * regenerating and re-reviewing thirty-eight copies of it.
 */
export declare function LandingDeck({ content }: LandingDeckProps): ReactElement;
/**
 * A family site's `/tour` — the SAME deck, opened by the tour strip.
 *
 * The strip is the first screen, ahead of the hero. Everything that says the reader is on a
 * tour — the step counter, the promise, the way on to the next site — has to be on the
 * screen they land on, and every screen in this deck is a full viewport with
 * `scroll-snap-align: start`. Below the hero it was one whole flick down, so `/tour` opened
 * on a screen identical to `/`. A tour stop announces itself or it is not a tour stop.
 */
export declare function LandingTour({ content }: LandingDeckProps): ReactElement;
//# sourceMappingURL=LandingDeck.d.ts.map