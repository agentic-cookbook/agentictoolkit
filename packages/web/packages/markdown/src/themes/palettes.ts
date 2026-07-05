// STANDING palette exception — owner-approved 2026-06-26: the markdown viewer owns its reading-theme palette (--mdv-*), separate from @adh-shared/themes apt-* tokens. Recorded as a project memory. Do not add raw color outside this file.
//
// This is the ONE module in @adh-shared/markdown permitted to contain concrete
// color literals. Every theme below is a self-contained palette mapping the
// viewer's own CSS-variable namespace (`--mdv-*`) to values. The component,
// renderer, CSS, and switcher reference ONLY `var(--mdv-*)` — never these hex
// values directly — so the reading themes stay fully data-driven: adding a theme
// = adding one entry here, with zero render-logic changes.
//
// Code-block (shiki) colors are NOT defined here: shiki emits its own
// `--shiki-light` / `--shiki-dark` CSS variables inline on its token spans, and
// the viewer CSS selects between them by the active `data-mdv-theme`.

/** The viewer-owned CSS custom-property names that make up a reading palette. */
export type MdvVarName =
  | '--mdv-bg'
  | '--mdv-surface'
  | '--mdv-surface-2'
  | '--mdv-text'
  | '--mdv-text-muted'
  | '--mdv-text-dim'
  | '--mdv-border'
  | '--mdv-border-strong'
  | '--mdv-link'
  | '--mdv-accent'
  | '--mdv-danger'
  | '--mdv-code-bg'
  | '--mdv-code-border'

/** A reading-theme palette: every `--mdv-*` variable mapped to a concrete value. */
export type MdvPalette = Record<MdvVarName, string>

/** Dark reading theme — charcoal surface, warm gold accent (platform-default feel). */
const DARK: MdvPalette = {
  '--mdv-bg': '#0c0c0f',
  '--mdv-surface': '#14141a',
  '--mdv-surface-2': '#1c1c24',
  '--mdv-text': '#e8e6e3',
  '--mdv-text-muted': '#8a8a9a',
  '--mdv-text-dim': '#5a5a6a',
  '--mdv-border': '#2a2a35',
  '--mdv-border-strong': '#3d3d50',
  '--mdv-link': '#6b8afd',
  '--mdv-accent': '#c4a35a',
  '--mdv-danger': '#d45454',
  '--mdv-code-bg': '#1c1c24',
  '--mdv-code-border': '#2a2a35',
}

/** Light reading theme — warm off-white surfaces, deepened accents for contrast. */
const LIGHT: MdvPalette = {
  '--mdv-bg': '#faf8f4',
  '--mdv-surface': '#f0ebe1',
  '--mdv-surface-2': '#e9e3d7',
  '--mdv-text': '#1f1d17',
  '--mdv-text-muted': '#5b5648',
  '--mdv-text-dim': '#8a8472',
  '--mdv-border': '#d3ccba',
  '--mdv-border-strong': '#b4ab95',
  '--mdv-link': '#3a5bd9',
  '--mdv-accent': '#8a6a14',
  '--mdv-danger': '#c0392b',
  '--mdv-code-bg': '#f0ebe1',
  '--mdv-code-border': '#d3ccba',
}

/** Sepia reading theme — warm parchment, low-eye-strain long-form reading. */
const SEPIA: MdvPalette = {
  '--mdv-bg': '#f4f1e8',
  '--mdv-surface': '#ede8d9',
  '--mdv-surface-2': '#e5dfcd',
  '--mdv-text': '#2c2416',
  '--mdv-text-muted': '#6b5a3e',
  '--mdv-text-dim': '#9b8a6a',
  '--mdv-border': '#c4b89a',
  '--mdv-border-strong': '#a89470',
  '--mdv-link': '#9a5b2a',
  '--mdv-accent': '#8b6914',
  '--mdv-danger': '#a8392b',
  '--mdv-code-bg': '#ede8d9',
  '--mdv-code-border': '#c4b89a',
}

/** GitHub reading theme — GitHub's familiar light color system for dev content. */
const GITHUB: MdvPalette = {
  '--mdv-bg': '#ffffff',
  '--mdv-surface': '#f6f8fa',
  '--mdv-surface-2': '#eaeef2',
  '--mdv-text': '#1f2328',
  '--mdv-text-muted': '#656d76',
  '--mdv-text-dim': '#9198a1',
  '--mdv-border': '#d0d7de',
  '--mdv-border-strong': '#afb8c1',
  '--mdv-link': '#0969da',
  '--mdv-accent': '#9a6700',
  '--mdv-danger': '#cf222e',
  '--mdv-code-bg': '#f6f8fa',
  '--mdv-code-border': '#d0d7de',
}

/** All built-in reading palettes, keyed by theme id. */
export const MDV_PALETTES: Record<string, MdvPalette> = {
  dark: DARK,
  light: LIGHT,
  sepia: SEPIA,
  github: GITHUB,
}
