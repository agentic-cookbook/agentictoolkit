// adh's theme-editor VOCABULARY: which surfaces of an adh site are themeable, what a
// live preview of each looks like, and the CSS editor that edits them.
//
// It lives here rather than in the toolkit because `areas.tsx` renders adh's own
// SiteHeader / SiteSwitcher / AdhFooter as its previews — the taxonomy is a statement
// about THIS product's chrome, not a generic editor. The toolkit's Debug console takes
// the whole thing as an injected prop (`ThemeAreasSurface`); `themeAreasSurface` below
// is the adapter that satisfies that contract.

export { THEME_AREAS, readItemCss, type ThemeArea, type ThemeItem } from './areas'
export { CssEditor } from './CssEditor'
export { themeAreasSurface } from './surface'
