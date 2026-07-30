import type { ThemeAreasSurface } from '@agentic-toolkit/adh/debug-env'

import { THEME_AREAS, readItemCss } from './areas'
import { CssEditor } from './CssEditor'

// The adapter that hands adh's theme taxonomy to the toolkit's Debug console.
//
// The console models an item as just `{ id, label, Preview? }` and asks for its CSS BY
// ID — deliberately, so the richer shape here (selector, custom properties, fallback
// block) stays adh's business. That is what this lookup bridges: the console names the
// item it is showing, and this side resolves it against the same THEME_AREAS the console
// was handed, so the two can never disagree about which item is which.
const ITEMS_BY_ID = new Map(THEME_AREAS.flatMap((area) => area.items).map((item) => [item.id, item]))

/** adh's {@link ThemeAreasSurface} — the value the Debug console takes as a prop. */
export const themeAreasSurface: ThemeAreasSurface = {
  areas: THEME_AREAS,
  readItemCss: (itemId, scope) => {
    const item = ITEMS_BY_ID.get(itemId)
    return item ? readItemCss(item, scope) : ''
  },
  CssEditor,
}
