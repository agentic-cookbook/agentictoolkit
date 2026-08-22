import { type ReactElement } from 'react'

/** The studio the Agentic Developer family sits under, set as the studio itself sets
 *  it: all lowercase, a sans face, and split two ways — `agentic development` bold and
 *  bright, `studio` lighter and dimmed. It closes the site menu below the last divider
 *  — the signature on the tree rather than a destination in it, which is why it is
 *  centered and unadorned instead of an iconed row like everything above.
 *
 *  The studio's own hero wordmark is the reference, NOT {@link SiteFooter}'s
 *  `BRAND_LABEL`, and the two are supposed to differ. The footer says the name inside
 *  a copyright sentence, where a logotype set lowercase in two weights would read as a
 *  typo; this is the mark itself, standing alone, so it is set the way the studio sets
 *  it. Same studio, two jobs — only the identity has to match, and it does.
 *
 *  The two halves are separate spans rather than one string with a `::first-line` or a
 *  `text-transform`, so the lowercase and the split live in the DOM: the accessible
 *  name, the copied text and a translation all get the real mark. The space between
 *  them is an explicit `{' '}` because JSX drops whitespace between elements on
 *  separate lines, and without it the mark reads `agentic developmentstudio`.
 *
 *  TEXT, not an image, and deliberately so: the mark is a wordmark set in theme
 *  tokens, so one rule reads correctly in both themes with no second asset; it stays
 *  legible at any zoom; and it is selectable and translatable. A raster or an inline
 *  SVG would need a light and a dark copy and would ship bytes to every site's header
 *  bundle for twenty-six characters of text.
 *
 *  `rel="noopener"` because the target is a different origin, and it opens in place
 *  rather than a new tab: the menu is a launcher, and every other destination in it
 *  navigates the same window. */
export function StudioWordmark(): ReactElement {
  return (
    <a
      className="adh-nav-popover__wordmark"
      href="https://agenticdevelopmentstudio.com"
      rel="noopener"
    >
      <span className="adh-nav-popover__wordmark-name">agentic development</span>{' '}
      <span className="adh-nav-popover__wordmark-kind">studio</span>
    </a>
  )
}
