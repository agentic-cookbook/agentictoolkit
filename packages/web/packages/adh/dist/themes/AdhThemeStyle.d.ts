/**
 * Injects the static ADH base theme (DEFAULT_ADH_THEME) so consumer routes stay
 * statically prerenderable (no per-request config), then the site's default theme
 * on top (DEFAULT_SITE_THEME, see SiteDefaultTheme). In staging/testing it instead
 * emits the theme-switcher payload (see ThemeSwitcherAssets), whose pre-paint applies
 * that same default.
 *
 * It also carries the APPEARANCE pre-paint script — the colour-mode (light/dark/auto) and
 * a11y bootstrap. That lives HERE, rather than in each site's layout, because this component
 * is already in the `<head>` of every site in the family: it is the one place a theming
 * concern can be added once and reach all ~45. (The hub used to inline the script itself,
 * which is exactly why no other site had a colour mode at all.)
 *
 * Consumers must set `suppressHydrationWarning` on their `<html>` — the script writes
 * `class`/`data-*` there before React hydrates, by design (the same contract next-themes has).
 */
export declare function AdhThemeStyle(): import("react").JSX.Element | null;
//# sourceMappingURL=AdhThemeStyle.d.ts.map