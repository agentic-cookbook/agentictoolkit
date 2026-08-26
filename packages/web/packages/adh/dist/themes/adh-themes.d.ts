/** TYPE-ONLY, and it has to stay that way. This module is reached by five of the
 *  package's entries, and tsup builds them with `splitting: false` — a value import of
 *  `@agenticdevelopertoolkit/themes/manifest` here survives into every one of those entries as a
 *  live `import` statement (esbuild keeps an external package's import for side effects
 *  even when tree-shaking leaves the binding unused), dragging ~39 whole stylesheets as
 *  strings behind a file that only wanted a string constant. The two functions that
 *  genuinely READ the manifest live in ./theme-keys for exactly this reason.
 *
 *  `import type { … }`, NOT `import { type … }`. The inline-modifier form leaves an
 *  import STATEMENT with no specifiers once the types are stripped, and esbuild emits
 *  that as a bare `import "@agenticdevelopertoolkit/themes/manifest"` — a side-effect import
 *  that still evaluates the module and still ships all 39 stylesheets. Only the
 *  type-only DECLARATION is erased outright. The two forms look interchangeable, and
 *  the difference is visible nowhere but the emitted dist. */
import type { ThemeKey } from '@agenticdevelopertoolkit/themes/manifest';
export type AdhThemeKey = Extract<ThemeKey, `adh${string}`>;
export declare const ADH_THEME_COOKIE = "adh-theme";
export type AdhThemeOption = {
    key: AdhThemeKey;
    label: string;
};
export declare const isBaseCutAlias: (key: string) => boolean;
/** The font-variant picker the cookie-driven ThemeSwitcher offers, and the key set
 *  `getAdhTheme` validates the stored cookie against. Filtered through
 *  BASE_CUT_ALIASES for the same reason `adhThemeKeys()` is — an alias row would be
 *  a second menu entry that renders identically to `adh` — and derived rather than
 *  hand-trimmed so the menu and the emitted alt-blocks cannot drift apart. A cookie
 *  still holding a filtered key simply fails validation and falls back to
 *  DEFAULT_ADH_THEME, which is that same cut. */
export declare const ADH_THEMES: AdhThemeOption[];
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
export declare const DEFAULT_ADH_THEME: AdhThemeKey;
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
 *  Keep in sync with the `html:root` selectors the theme CSS is generated with.
 *
 *  A theme may also be DARK-ALWAYS, which is the same contract taken one step further:
 *  instead of a light block with light values, it lists the light-mode selectors
 *  alongside the dark one and gives them the dark palette, adding the two
 *  `[data-contrast]` forms and the `:not([data-contrast])` form so it also outranks
 *  color-mode-light's contrast rules (0-4-0 / 0-5-0) rather than only its base block.
 *  `charcoal` and `fishlamp` are the two that do this; fishlamp's header comment carries
 *  the arithmetic. For the family's DEFAULT theme it is not optional — see
 *  DEFAULT_SITE_THEME below, and rule 6 in fullPaletteThemes.test.ts, which asserts it. */
export declare const FULL_PALETTE_THEMES: readonly ["signal", "nord", "solarized", "rose-pine", "gruvbox", "github", "tokyo-night", "catppuccin", "one-dark", "dracula", "monokai", "cobalt2", "synthwave84", "vesper", "agenticcookbookweb", "dev-team", "mikefullerton", "myprojects", "myprojectsoverview", "professional", "techy", "terminal", "terminal-split", "whimsical", "green-matrix", "green-matrix-glass", "old-school-terminal", "charcoal", "fishlamp"];
export type FullPaletteThemeKey = (typeof FULL_PALETTE_THEMES)[number];
/** Any theme the footer switcher can select: adh font-variants + full-palette themes. */
export type SwitcherThemeKey = AdhThemeKey | FullPaletteThemeKey;
/** The theme the site PRESENTS by default — what a visitor with no stored choice sees,
 *  in every env including production. Layered over DEFAULT_ADH_THEME (which stays the
 *  base/typography layer) rather than replacing it: a full-palette theme self-scopes at
 *  `html:root`, so it outranks the base's `:root` in dark and color-mode-light in light,
 *  while the base keeps supplying the `.text-*` utilities it never defines.
 *  Naming an adh font-variant here works too — its `:root` delta wins on source order.
 *
 *  This ONE constant dresses all ~45 family sites: no site passes a theme, they all render
 *  `<AdhThemeStyle />` with no props, so changing it here is the whole change.
 *
 *  It is `charcoal` — the palette the family wore before `fishlamp` briefly replaced it,
 *  kept as a theme in its own right for exactly this reason. The value before either of
 *  them was DEFAULT_ADH_THEME itself, which is why SiteDefaultTheme has a branch for the
 *  two matching (it renders nothing then, the base block already being the site's theme);
 *  that branch stays the un-taken one — `charcoal` is a full-palette theme, not the base —
 *  and the base stays emitted underneath for the `.text-*` typography utilities no
 *  full-palette theme defines. `fishlamp` remains pickable in the switcher, so swapping the
 *  family back to it is a one-word edit here.
 *
 *  Whatever this names must be DARK-ALWAYS. The family ships one presentation and it is
 *  dark whatever the device says, and this constant is the only thing that decides which
 *  palette says so: Appearance has no light/dark control, so a mode-split theme here means
 *  a light-OS visitor gets a light site with no way back. That is not a hypothetical — it
 *  is what shipped for the window in which this pointed at a mode-split `charcoal`, in
 *  silence. fullPaletteThemes.test.ts asserts the property off THIS constant, so the next
 *  swap is checked rather than trusted. */
export declare const DEFAULT_SITE_THEME: SwitcherThemeKey;
/** Whether `key` paints in the base theme's self-hosted faces — i.e. whether the base's
 *  font preloads are worth emitting for a page whose winning theme is `key`. */
export declare const usesBaseThemeFonts: (key: string) => boolean;
export declare const isFullPaletteTheme: (key: string) => key is FullPaletteThemeKey;
//# sourceMappingURL=adh-themes.d.ts.map