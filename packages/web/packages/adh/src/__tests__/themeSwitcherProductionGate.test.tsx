/**
 * What production's `<head>` actually contains.
 *
 * This is the outermost gate on site-theme switching: the client switcher keys off the
 * presence of `<style data-adh-theme-alt>` nodes, so withholding them in production is
 * what makes the feature not exist there — no switchable payload, nothing to flip. Every
 * other gate (the Debug console topic, the site menu's dev tail, the theme-carry) sits
 * behind this one, and the assertions here are on the RENDERED OUTPUT rather than on the
 * predicate, because that is the thing a visitor receives.
 *
 * The failure is silent and it is a payload regression, not a crash: switch the allowlist
 * to `!== 'production'`, mis-set DEPLOYMENT_ENV, or let a refactor evaluate the gate at
 * module load (where the server's env may not be set yet) and production quietly starts
 * shipping ~27 whole stylesheets plus a pre-paint script to every page. Nothing errors.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdhThemeStyle } from '../themes/AdhThemeStyle'
import { DEFAULT_ADH_THEME } from '../themes/adh-themes'
import { switcherThemeKeys } from '../themes/theme-keys'

const ORIGINAL = process.env.DEPLOYMENT_ENV

afterEach(() => {
  process.env.DEPLOYMENT_ENV = ORIGINAL
})

/** The head markup this env would serve. The gate is read per render (not at module
 *  load), which is what lets one process render both — and is itself load-bearing: on
 *  the server the env is read at request time. */
function headAt(env: string | undefined): string {
  if (env === undefined) delete process.env.DEPLOYMENT_ENV
  else process.env.DEPLOYMENT_ENV = env
  return renderToStaticMarkup(<AdhThemeStyle />)
}

describe('AdhThemeStyle', () => {
  it('ships NO switcher payload in production', () => {
    const html = headAt('production')
    expect(html).not.toContain('data-adh-theme-alt')
    // The pre-paint that would apply a stored/carried theme choice goes with it. The
    // APPEARANCE pre-paint (colour mode + a11y) is a different script and stays.
    expect(html).not.toContain('adh-theme-alt')
    expect(html).not.toContain('data-adh-theme-switch-font')
  })

  it('still ships the base theme in production — the site is themed, just not switchable', () => {
    // The point of the gate is to remove the SWITCHER, not the styling. If this ever goes
    // quiet, production renders unstyled.
    const html = headAt('production')
    expect(html).toContain(`data-adh-theme="${DEFAULT_ADH_THEME}"`)
    expect(html).toContain('--color-primary')
  })

  it('ships every switchable theme in a dev env', () => {
    const html = headAt('testing')
    // Anchored on `<style` on purpose: the pre-paint script also mentions the attribute
    // (it builds the selector it flips), and those matches are not emitted themes.
    const emitted = Array.from(
      html.matchAll(/<style [^>]*data-adh-theme-alt="([^"]+)"/g),
      (m) => m[1],
    )
    expect(emitted).toEqual([...switcherThemeKeys()])
    // Restored-theme spot check: these three existed only in the old registry and were
    // never wired into the switcher, so a regression in the port shows up here as an
    // absence rather than an error.
    expect(emitted).toEqual(
      expect.arrayContaining(['green-matrix', 'green-matrix-glass', 'old-school-terminal']),
    )
  })

  it('ships a full-palette theme WHOLE, self-scoped for both colour modes', () => {
    // Not a `:root` delta like the adh font-variants: a full-palette theme replaces the
    // base, so it has to arrive with both mode blocks or it half-applies (see
    // fullPaletteThemes.test.ts for why per-mode specificity is the whole trick).
    const html = headAt('testing')
    const block = /data-adh-theme-alt="green-matrix"[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1]
    expect(block, 'green-matrix emitted no CSS').toBeTruthy()
    expect(block).toContain('html:root')
    expect(block).toContain('html:root[data-color-mode]:not(.dark)')
  })

  it('fails SAFE on an unknown or missing env', () => {
    // Production is inferred, never required: a renamed env or an unset var must land on
    // the no-switcher side. (Unset is the realistic one — a misconfigured deploy.)
    for (const env of ['prod', 'Production', 'preview', '', undefined]) {
      expect(headAt(env), String(env)).not.toContain('data-adh-theme-alt')
    }
  })

  it('emits far less markup in production than in a dev env', () => {
    // The blunt whole-payload check the per-attribute assertions above can't make: if the
    // gate stops holding, this is the visitor-visible cost.
    expect(headAt('production').length * 4).toBeLessThan(headAt('testing').length)
  })
})
