/**
 * Markdown viewer reading-theme registry.
 *
 * Each entry pairs a human label with a `--mdv-*` palette (defined in the single
 * color-bearing module `./palettes`). Switching themes swaps the palette applied
 * on the viewer's content root via inline CSS custom properties + a
 * `data-mdv-theme` attribute, so the renderer reads ALL styling from the palette
 * — never per-theme branches or hardcoded colors.
 *
 * Adding a new theme = add a palette to `./palettes` and a registry entry here.
 * No render-logic changes. (Owner decision 2026-06-26: this palette is the
 * viewer's own, kept separate from the global @agentic-toolkit/themes apt-* tokens.)
 */

import { MDV_PALETTES } from './palettes'
import type { MdvPalette } from './palettes'

export type { MdvPalette, MdvVarName } from './palettes'

export interface ViewerTheme {
  /** Unique machine id (persisted to localStorage; also the data-mdv-theme value). */
  id: string
  /** Human-readable label shown in the switcher. */
  label: string
  /** The viewer-owned `--mdv-*` palette applied on the content root. */
  palette: MdvPalette
  /**
   * Which of shiki's dual-theme variants the code blocks use. shiki emits both
   * `--shiki-light` and `--shiki-dark` vars on every token; the viewer CSS picks
   * one by `data-mdv-shiki-variant`. Declaring it per theme (rather than a
   * hardcoded `[data-mdv-theme='dark']` rule) keeps the c7 promise: adding a new
   * (even dark) theme is a registry entry with no CSS/render change.
   */
  shikiVariant: 'light' | 'dark'
}

/** All built-in reading themes. Max 10 per contract (c7). */
export const VIEWER_THEMES: readonly ViewerTheme[] = [
  { id: 'dark', label: 'Dark', palette: MDV_PALETTES['dark']!, shikiVariant: 'dark' },
  { id: 'light', label: 'Light', palette: MDV_PALETTES['light']!, shikiVariant: 'light' },
  { id: 'sepia', label: 'Sepia', palette: MDV_PALETTES['sepia']!, shikiVariant: 'light' },
  { id: 'github', label: 'GitHub', palette: MDV_PALETTES['github']!, shikiVariant: 'light' },
] as const

/** Default theme applied before any persisted preference exists. */
export const DEFAULT_THEME_ID = 'dark'

/**
 * Lookup a theme by id; falls back to the DEFAULT theme BY ID (not by array
 * position). Position-based fallback would diverge from the bootstrap script —
 * which falls back by `DEFAULT_THEME_ID` — if VIEWER_THEMES were ever reordered,
 * producing a theme flash on reload for an unknown id.
 */
export function getThemeById(id: string): ViewerTheme {
  return (
    VIEWER_THEMES.find((t) => t.id === id) ??
    VIEWER_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
  )
}

/**
 * The set of valid theme ids. Used to validate a persisted localStorage value
 * before applying it (so a stale/removed id falls back to the default rather
 * than producing a blank switcher + a bootstrap/React data-mdv-theme mismatch).
 */
export const VIEWER_THEME_IDS: readonly string[] = VIEWER_THEMES.map((t) => t.id)

/** True if `id` names a built-in reading theme. */
export function isValidThemeId(id: string | null | undefined): id is string {
  return id != null && VIEWER_THEME_IDS.includes(id)
}

/**
 * Maps each theme id to its shiki code-block variant. Consumed by the viewer's
 * render (`data-mdv-shiki-variant`) and inlined into the no-flash bootstrap
 * script, so code-block colors are correct before hydration too.
 */
export const SHIKI_VARIANT_BY_ID: Record<string, 'light' | 'dark'> =
  Object.fromEntries(VIEWER_THEMES.map((t) => [t.id, t.shikiVariant]))
