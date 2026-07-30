import { themes } from '@agentic-toolkit/themes/manifest'
import { splitImports, parseRootProps } from '@agentic-toolkit/themes/tokens'
import { APPEARANCE_PREPAINT_SCRIPT } from '@agentic-toolkit/themes/appearance'
import {
  DEFAULT_ADH_THEME,
  DEFAULT_SITE_THEME,
  switcherThemeKeys,
  isFullPaletteTheme,
  type SwitcherThemeKey,
} from './adh-themes'
import { themePrePaintScript } from './theme-preview'
// Package-path (not relative): keeps this 'use client' leaf a preserved import so
// server.ts's bundle never inlines it — see the matching `external` entry/comment in
// tsup.config.ts for why inlining it would break `getAdhTheme`'s next/headers import.
import { DbThemeApplier } from '@agentic-toolkit/adh/themes/DbThemeApplier'

// Theme switching is gated to non-production (local/testing/staging) so production
// routes stay exactly as they are (one static theme, no extra payload, no client
// switcher). `local` is what the `dev.local` suite sets for the local suite.
// A plain array (not `new Set(...)`), deliberately: this module is inlined into
// both dist/server.js and dist/themes/index.js (see AdhThemeStyle's two exports in
// tsup.config.ts), and a top-level `const X = new Set(...)` is exactly the
// module-state-fork shape frontend/tools/verify-bundle-boundaries.py's Check B
// flags — even though this particular Set is read-only and would have been inert,
// the toolkit's policy is to remove the shape rather than allowlist it.
const SWITCHER_ENVS = ['local', 'staging', 'testing']

const switcherEnv = () => SWITCHER_ENVS.includes(process.env.DEPLOYMENT_ENV ?? '')

/**
 * Builds the local/staging/testing-only theme-switcher payload: each switchable theme
 * as an INACTIVE `<style data-adh-theme-alt>`. adh-family themes share the base palette,
 * so their block is just a `:root` delta of the props that differ (a few font vars — the
 * rest comes from the always-on default block); full-palette themes carry their WHOLE
 * `html:root`-scoped stylesheet (own M3 roles + legacy tokens + structural CSS), since
 * they replace the base rather than tweak it. Flipping one to media="all" re-themes the
 * page with no fetch/FOUC. Plus each theme's fonts and a pre-paint script (see
 * themePrePaintScript) that applies the stored/carried choice before first paint. Returns
 * null in production — DEPLOYMENT_ENV is read on the server only and never shipped (the
 * switcher keys off the presence of these <style> nodes instead).
 */
function ThemeSwitcherAssets({ defaultImports }: { defaultImports: string[] }) {
  if (!switcherEnv()) return null

  const already = new Set(defaultImports)
  const fonts = new Set<string>()
  const baseProps = parseRootProps(themes[DEFAULT_ADH_THEME].css)
  const blocks: { key: SwitcherThemeKey; css: string }[] = []
  for (const key of switcherThemeKeys()) {
    const { imports, rest } = splitImports(themes[key].css)
    imports.forEach((u) => !already.has(u) && fonts.add(u))
    if (isFullPaletteTheme(key)) {
      // Full-palette themes carry their WHOLE stylesheet (own M3 roles + legacy tokens
      // + structural CSS), self-scoped via html:root / html:root[data-color-mode] so an
      // active one outranks the base theme AND color-mode-light. No delta over the base.
      blocks.push({ key, css: rest })
    } else {
      // adh family shares the base palette, so ship only the props that differ (fonts).
      const delta = [...parseRootProps(rest)].filter(([k, v]) => baseProps.get(k) !== v)
      blocks.push({ key, css: `:root{${delta.map(([k, v]) => `${k}:${v}`).join(';')}}` })
    }
  }

  const prePaint = themePrePaintScript()

  return (
    <>
      {[...fonts].map((href) => (
        <link key={`sw:${href}`} rel="stylesheet" href={href} data-adh-theme-switch-font="" />
      ))}
      {/* Every switchable theme as an INACTIVE block (adh-family: a `:root` delta;
          full-palette: its whole `html:root` stylesheet); the pre-paint (and the
          ThemeSwitcher) activate exactly one via `media`. suppressHydrationWarning
          because that flip happens before hydration on these very nodes. */}
      {blocks.map(({ key, css }) => (
        <style
          key={`alt:${key}`}
          data-adh-theme-alt={key}
          media="not all"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ))}
      {/* Trusted, static bootstrap (no user input). */}
      <script dangerouslySetInnerHTML={{ __html: prePaint }} />
      {/* Applies a persisted DB theme on load (seeds ride the pre-paint above). */}
      <DbThemeApplier />
    </>
  )
}

/**
 * The site's default theme (DEFAULT_SITE_THEME), emitted ALWAYS-ON over the base block —
 * this is what a visitor sees with no stored choice. Only rendered OUTSIDE the switcher
 * envs: where the switcher exists, the default is instead applied by the pre-paint
 * flipping its alt-block (same result, before first paint), which keeps it a single
 * flippable node so selecting another theme can deactivate it. Emitting it here too
 * would make that block un-deactivatable and pin production's theme past the switcher.
 *
 * Nothing is emitted when the site theme IS the base theme — the base block already is it.
 */
function SiteDefaultTheme({ baseImports }: { baseImports: string[] }) {
  if (switcherEnv() || DEFAULT_SITE_THEME === DEFAULT_ADH_THEME) return null
  const entry = themes[DEFAULT_SITE_THEME]
  if (!entry) return null
  const { imports, rest } = splitImports(entry.css)
  const already = new Set(baseImports)
  return (
    <>
      {imports
        .filter((href) => !already.has(href))
        .map((href) => (
          <link
            key={href}
            rel="stylesheet"
            href={href}
            data-adh-theme-import={DEFAULT_SITE_THEME}
          />
        ))}
      <style
        data-adh-site-theme={DEFAULT_SITE_THEME}
        dangerouslySetInnerHTML={{ __html: rest }}
      />
    </>
  )
}

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
export function AdhThemeStyle() {
  const entry = themes[DEFAULT_ADH_THEME]
  if (!entry) return null
  const { imports, rest } = splitImports(entry.css)
  return (
    <>
      {imports.map((href) => (
        <link
          key={href}
          rel="stylesheet"
          href={href}
          data-adh-theme-import={DEFAULT_ADH_THEME}
        />
      ))}
      <style
        data-adh-theme={DEFAULT_ADH_THEME}
        dangerouslySetInnerHTML={{ __html: rest }}
      />
      {/* Applies the user's colour mode + a11y prefs to <html> BEFORE first paint, so a
          signed-in user's theme doesn't flash. Reads this browser's cached copy; the server
          is the truth and AppearanceSync (@agentic-toolkit/adh/auth) reconciles a moment
          later. With no cache — a first visit, or a signed-out visitor — colour mode is
          `auto`, i.e. the OS setting. Static, self-authored script (no user input). */}
      <script dangerouslySetInnerHTML={{ __html: APPEARANCE_PREPAINT_SCRIPT }} />
      <SiteDefaultTheme baseImports={imports} />
      <ThemeSwitcherAssets defaultImports={imports} />
    </>
  )
}
