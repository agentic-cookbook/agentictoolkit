import { describe, expect, it } from 'vitest'
import * as server from '../server'

describe('@agentic-toolkit/adh/server is the union of both pre-merge surfaces', () => {
  // From the toolkit's own pre-merge server.ts — dropping any of these breaks
  // adh/src/debug/DebugMenu.tsx and adh/src/index.ts inside this package.
  it('keeps every toolkit-side export', () => {
    for (const name of ['getAdhTheme', 'AdhThemeStyle', 'ADH_THEME_COOKIE', 'ADH_THEMES', 'DEFAULT_ADH_THEME'])
      expect(server, name).toHaveProperty(name)
  })

  // From the pre-rename @adh-shared/adh's src/server.ts — DEFAULT_SITE_THEME is the one the toolkit
  // never had, and the one a naive "the toolkit is already a superset" merge loses.
  it('gains the adh-side exports', () => {
    expect(server).toHaveProperty('DEFAULT_SITE_THEME')
    // The VALUES track whatever the family currently wears, and the two are INDEPENDENT:
    // DEFAULT_ADH_THEME is the always-on base/typography layer, DEFAULT_SITE_THEME the
    // palette layered over it. They were briefly the same key (`adh` IS the Iosevka cut,
    // so the typography layer was also the presentation); `charcoal` — a full-palette
    // theme — is layered over that base now, which is the arrangement this file has to
    // keep distinguishing, since a merge that collapsed the two exports would still pass
    // an assertion written as `toBe(DEFAULT_ADH_THEME)`.
    expect(server.DEFAULT_ADH_THEME).toBe('adh')
    expect(server.DEFAULT_SITE_THEME).toBe('charcoal')
  })

  // AdhThemeStyle is the symbol all 20 consumers actually import, and adh's is the
  // 163-line version (switcher assets + pre-paint + DbThemeApplier), not the 31-line stub.
  it('exports the adh implementation of AdhThemeStyle, not the stub', () => {
    expect(String(server.AdhThemeStyle)).toMatch(/ThemeSwitcherAssets|DbThemeApplier/)
  })
})
