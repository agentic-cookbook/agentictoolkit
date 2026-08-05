// `@agentic-toolkit/adh/server` (src/server.ts) also exports AdhThemeStyle, as a
// server module — that is the intended import path. This barrel is 'use client',
// so importing AdhThemeStyle from here yields a CLIENT instance, which renders
// after hydration instead of during SSR, defeating the pre-paint style injection
// this component exists for (no type error, no build error). Kept only because
// the union barrel is mandated; every current consumer imports from `/server`.
export { AdhThemeStyle } from './AdhThemeStyle'
export { ThemeSwitcher } from './ThemeSwitcher'
export type { ThemeSwitcherProps } from './ThemeSwitcher'
export {
  ADH_THEME_COOKIE,
  ADH_THEMES,
  DEFAULT_ADH_THEME,
  DEFAULT_SITE_THEME,
  FULL_PALETTE_THEMES,
  isFullPaletteTheme,
} from './adh-themes'
export { switcherThemeKeys } from './theme-keys'
export type {
  AdhThemeKey,
  AdhThemeOption,
  SwitcherThemeKey,
  FullPaletteThemeKey,
} from './adh-themes'

// The theme editor surface — merged in from the pre-rename @adh-shared/adh's themes tree.
export { useThemeEditor } from './useThemeEditor'
export type { ThemeEditorApi, ThemeSource, EditorTheme, CssMap } from './useThemeEditor'
export { DbThemeApplier } from '@agentic-toolkit/adh/themes/DbThemeApplier'
export {
  THEME_STORAGE_KEY,
  ALT_STYLE_SELECTOR,
  cookieDomain,
  readStoredTheme,
  persistTheme,
  applyBaseTheme,
  readPreviewTheme,
  appendThemePreview,
  themePrePaintScript,
} from './theme-preview'
export { applyThemeCss, clearThemeOverride } from './theme-overrides'
export { isSwitcherSeed, concatItemCss } from './resolve'
export { listThemes, createTheme, updateTheme, deleteTheme } from './themes-client'
export type { StoredTheme, ThemeWrite } from './themes-client'
