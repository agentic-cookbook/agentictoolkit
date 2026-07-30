import { themes, type ThemeKey } from '@agentic-toolkit/themes/manifest'

export type AdhThemeKey = Extract<ThemeKey, `adh${string}`>

export const ADH_THEME_COOKIE = 'adh-theme'

export type AdhThemeOption = {
  key: AdhThemeKey
  label: string
}

/** Registered adh* keys that are now the SAME CUT as DEFAULT_ADH_THEME and so are
 *  not offered as separate choices. `adh-iosevka` predates `adh` becoming the
 *  Iosevka cut: its delta over the base is empty, so it emitted a literal `:root{}`
 *  alt-block and sat in the menu as a second entry that visibly did nothing.
 *
 *  The key stays REGISTERED in the theme manifest rather than being deleted —
 *  saved DB themes may still record `basedOn: 'adh-iosevka'`, and both consumers
 *  fall back to the base when a seed isn't in this list (`baseSeedOf` in
 *  useThemeEditor, and the alt-block lookup in theme-preview), which resolves to
 *  the identical CSS anyway. Declared above ADH_THEMES because that table filters
 *  through it at module scope — a `const` read before its initializer is a TDZ
 *  throw, not a silent `undefined`.
 *
 *  A frozen tuple + `.includes`, deliberately NOT a `Set`: this module is inlined
 *  into five of the package's entries (dist/index, dist/server, dist/debug,
 *  dist/themes/index, dist/themes/DbThemeApplier), and verify-bundle-boundaries.py
 *  CHECK B rejects a top-level `new Set(...)` reached from more than one entry —
 *  each entry would get its own copy. Nothing mutates this one, but the guard is
 *  deliberately shape-based and the toolkit allows no allowlist entry, so the
 *  membership test is spelled the same way FULL_PALETTE_THEMES spells its own. */
const BASE_CUT_ALIASES = ['adh-iosevka'] as const satisfies readonly ThemeKey[]

const isBaseCutAlias = (key: string): boolean =>
  (BASE_CUT_ALIASES as readonly string[]).includes(key)

/** The font-variant picker the cookie-driven ThemeSwitcher offers, and the key set
 *  `getAdhTheme` validates the stored cookie against. Filtered through
 *  BASE_CUT_ALIASES for the same reason `adhThemeKeys()` is — an alias row would be
 *  a second menu entry that renders identically to `adh` — and derived rather than
 *  hand-trimmed so the menu and the emitted alt-blocks cannot drift apart. A cookie
 *  still holding a filtered key simply fails validation and falls back to
 *  DEFAULT_ADH_THEME, which is that same cut. */
export const ADH_THEMES: AdhThemeOption[] = (
  [
    { key: 'adh', label: 'ADH' },
    { key: 'adh-iosevka', label: 'Iosevka' },
    { key: 'adh-manrope', label: 'Manrope' },
    { key: 'adh-courier', label: 'Courier' },
    { key: 'adh-comic', label: 'Comic' },
    { key: 'adh-jetbrains', label: 'JetBrains' },
    { key: 'adh-fira', label: 'Fira' },
  ] satisfies AdhThemeOption[]
).filter((t) => !isBaseCutAlias(t.key))

/** The BASE ADH theme — statically injected by AdhThemeStyle so production routes
 *  stay prerenderable (no per-request config). This is the always-on bottom layer:
 *  it carries the base palette AND the `.text-*` M3 typography utilities, which the
 *  full-palette themes below do NOT redefine — so it stays emitted even when the
 *  site's default theme is one of them. To restyle the site, set DEFAULT_SITE_THEME;
 *  change this only to move the typography/base layer itself.
 *
 *  `adh` IS the Iosevka cut — it sets sans, serif and mono all three to Iosevka
 *  (the `adh-*` siblings are that same palette with a different typeface bolted
 *  on, which is exactly what `adh-manrope` used to do here). So the family's
 *  typography layer and its default presentation are one theme, not two, and
 *  DEFAULT_SITE_THEME below names the same key. */
export const DEFAULT_ADH_THEME: AdhThemeKey = 'adh'

/** Full-palette themes: complete light+dark palettes (their own M3 color roles +
 *  legacy tokens), NOT adh font-variants. The switcher offers these alongside the
 *  adh family, but they differ in two ways handled elsewhere:
 *   - AdhThemeStyle emits their ENTIRE CSS (not a `:root` delta over the base), and
 *   - each self-scopes light/dark via `html:root` / `html:root[data-color-mode]:not(.dark)`,
 *     and the outranking is PER-MODE — both selectors carry the extra `html` type over the
 *     base's bare `:root`: the dark `html:root` (0-1-1) beats the base theme (`:root`, 0-1-0),
 *     and the light `html:root[data-color-mode]:not(.dark)` (0-3-1) beats color-mode-light
 *     (`:root[data-color-mode]:not(.dark)`, 0-3-0), each winning on specificity in its own
 *     mode with no reliance on stylesheet source order. Note `html:root` ALONE (0-1-1) does
 *     NOT outrank color-mode-light (0-3-0), so a full-palette theme MUST ship the light block
 *     too — dropping it silently reverts its light-mode colors toward the base palette.
 *     (The editor's live override is boosted past both, see theme-overrides.boostRootSpecificity.)
 *  Keep in sync with the `html:root` selectors the theme CSS is generated with. */
export const FULL_PALETTE_THEMES = [
  'signal',
  'nord',
  'solarized',
  'rose-pine',
  'gruvbox',
  'github',
  'tokyo-night',
  'catppuccin',
  'one-dark',
  'dracula',
  'monokai',
  'cobalt2',
  'synthwave84',
  'vesper',
] as const satisfies readonly ThemeKey[]

export type FullPaletteThemeKey = (typeof FULL_PALETTE_THEMES)[number]

/** Any theme the footer switcher can select: adh font-variants + full-palette themes. */
export type SwitcherThemeKey = AdhThemeKey | FullPaletteThemeKey

/** The theme the site PRESENTS by default — what a visitor with no stored choice sees,
 *  in every env including production. Layered over DEFAULT_ADH_THEME (which stays the
 *  base/typography layer) rather than replacing it: a full-palette theme self-scopes at
 *  `html:root`, so it outranks the base's `:root` in dark and color-mode-light in light,
 *  while the base keeps supplying the `.text-*` utilities it never defines.
 *  Naming an adh font-variant here works too — its `:root` delta wins on source order.
 *
 *  It is the SAME key as DEFAULT_ADH_THEME: every site in the family presents adh in
 *  Iosevka, so there is no second layer to emit over the base. SiteDefaultTheme sees
 *  the two match and renders nothing (the base block already IS the site's theme), and
 *  in the switcher envs the pre-paint flips adh's own — empty — alt-block. Point this
 *  at a different key to dress the family in something else without disturbing the
 *  typography layer above. */
export const DEFAULT_SITE_THEME: SwitcherThemeKey = 'adh'

export const isFullPaletteTheme = (key: string): key is FullPaletteThemeKey =>
  (FULL_PALETTE_THEMES as readonly string[]).includes(key)

/** Every adh* theme key the switcher offers — the delta-over-base font variants,
 *  minus the BASE_CUT_ALIASES declared at the top of this file. */
export const adhThemeKeys = (): AdhThemeKey[] =>
  (Object.keys(themes) as ThemeKey[]).filter(
    (k): k is AdhThemeKey => k.startsWith('adh') && !isBaseCutAlias(k),
  )

/** Every switchable theme key — the set the switcher menu offers and AdhThemeStyle
 *  emits alt-blocks for. adh family (emitted as `:root` deltas) + full-palette themes
 *  (emitted whole). Single source so the menu and the emitted blocks can't diverge. */
export const switcherThemeKeys = (): SwitcherThemeKey[] => [
  ...adhThemeKeys(),
  ...FULL_PALETTE_THEMES,
]
