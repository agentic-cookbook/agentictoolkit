export { themes, themeIds, type ThemeKey, type ThemeEntry } from './manifest'
export { ThemeStyle, type ThemeStyleProps } from './ThemeStyle'
export {
  ColorModeProvider,
  useColorMode,
  type ColorMode,
  type ColorModeProviderProps,
  type ResolvedColorMode,
} from './colorMode'
export {
  APPEARANCE_DEFAULTS,
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_PREPAINT_SCRIPT,
  applyAppearance,
  normalizeAppearance,
  readStoredAppearance,
  type AppearancePrefs,
  type ColorModePref,
  type ReduceMotionPref,
  type ContrastPref,
  type TextSizePref,
  type SpacingPref,
} from './appearance'
export {
  useAppearancePreferences,
  adoptAppearance,
  resetAppearance,
  type UseAppearancePreferences,
} from './appearance-store'
