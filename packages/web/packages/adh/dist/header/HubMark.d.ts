import type { ReactElement } from 'react';
export type HubMarkProps = {
    /** Extra classes on the root svg (size/color it from the call site). */
    className?: string;
};
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
export declare function HubMark({ className }: HubMarkProps): ReactElement;
//# sourceMappingURL=HubMark.d.ts.map