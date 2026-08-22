import { type ReactElement } from 'react';
/** The studio the Agentic Developer family sits under, set exactly as the site
 *  footer sets it: title case, the footer's mono face, the accent colour. It closes
 *  the site menu below the last divider — the signature on the tree rather than a
 *  destination in it, which is why it is centered and unadorned instead of an iconed
 *  row like everything above.
 *
 *  The footer's brand link is the reference because it is the same mark in the same
 *  product, and two spellings of one studio's name read as two studios. The literal
 *  string is therefore kept in step with {@link SiteFooter}'s `BRAND_LABEL` and the
 *  CSS with `.adh-footer__brand-link`; they are not shared, because a menu signature
 *  and a footer credit are free to diverge in placement and size, and only the
 *  identity has to match.
 *
 *  TEXT, not an image, and deliberately so: the mark is a wordmark set in a theme
 *  token, so one rule reads correctly in both themes with no second asset; it stays
 *  legible at any zoom; and it is selectable and translatable. A raster or an inline
 *  SVG would need a light and a dark copy and would ship bytes to every site's header
 *  bundle for twenty-six characters of text.
 *
 *  `rel="noopener"` because the target is a different origin, and it opens in place
 *  rather than a new tab: the menu is a launcher, and every other destination in it
 *  navigates the same window. */
export declare function StudioWordmark(): ReactElement;
//# sourceMappingURL=StudioWordmark.d.ts.map