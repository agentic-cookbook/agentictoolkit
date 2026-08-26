import { describe, expect, it } from 'vitest'
import { themes } from '@agenticdevelopertoolkit/themes/manifest'
import { ADH_THEMES, DEFAULT_ADH_THEME } from '../themes/adh-themes'
import { adhThemeKeys, switcherThemeKeys } from '../themes/theme-keys'

// `adh` became the Iosevka cut in main's theme (#134), which left `adh-iosevka`
// registered in the manifest but identical to the base — a second menu row that
// visibly did nothing and emitted a literal `:root{}` alt-block. adh-themes.ts
// filters it out through BASE_CUT_ALIASES. These lock the two halves of that
// contract: the key stays REGISTERED (saved DB themes may still record
// `basedOn: 'adh-iosevka'`, and both consumers fall back through the manifest),
// but it is never OFFERED.
describe('base-cut aliases are registered but never offered', () => {
  it('keeps adh-iosevka in the theme manifest', () => {
    expect(themes).toHaveProperty('adh-iosevka')
  })

  it('drops it from the switcher menu', () => {
    expect(ADH_THEMES.map((t) => t.key)).not.toContain('adh-iosevka')
    expect(adhThemeKeys()).not.toContain('adh-iosevka')
    expect(switcherThemeKeys()).not.toContain('adh-iosevka')
  })

  it('still offers the base cut it aliases', () => {
    expect(ADH_THEMES.map((t) => t.key)).toContain(DEFAULT_ADH_THEME)
    expect(adhThemeKeys()).toContain(DEFAULT_ADH_THEME)
  })

  // ADH_THEMES is a hand-written table; adhThemeKeys() derives from the manifest.
  // They are NOT equal — the manifest also carries `adh-dev-preview`, which is an
  // adh* key by prefix but deliberately absent from the menu — so the invariant is
  // containment, not equality: nothing may sit in the menu that has no registered
  // theme behind it, or the switcher offers a row whose CSS never gets emitted.
  it('offers only keys the manifest actually registers', () => {
    for (const { key } of ADH_THEMES) expect(themes, key).toHaveProperty(key)
  })
})
