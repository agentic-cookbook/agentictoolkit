import { type ReactElement } from 'react';
/** The studio the Agentic Developer family sits under, as it signs itself: all
 *  lowercase, widely tracked, on one line. It closes the site menu below the last
 *  divider — the signature on the tree rather than a destination in it, which is
 *  why it is centered and unadorned instead of an iconed row like everything above.
 *
 *  TEXT, not an image, and deliberately so: the mark is a wordmark set in the page's
 *  own font, so it inherits `currentColor` (it reads correctly in both themes with no
 *  second asset), it stays legible at any zoom, and it is selectable and translatable.
 *  A raster or an inline SVG would need a light and a dark copy and would ship bytes
 *  to every site's header bundle for twenty-six characters of text.
 *
 *  `rel="noopener"` because the target is a different origin, and it opens in place
 *  rather than a new tab: the menu is a launcher, and every other destination in it
 *  navigates the same window. */
export declare function StudioWordmark(): ReactElement;
//# sourceMappingURL=StudioWordmark.d.ts.map