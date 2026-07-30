'use client'

import { useEffect } from 'react'

import { DEFAULT_ADH_THEME } from './adh-themes'
import { ALT_STYLE_SELECTOR, readStoredTheme } from './theme-preview'
import { isSwitcherSeed, concatItemCss } from './resolve'
import { applyBaseTheme, applyThemeCss } from './theme-overrides'
import { listThemes } from './themes-client'

// Applies a persisted DB theme on load. Seeds are handled by the pre-paint media-flip
// (AdhThemeStyle's alt-blocks, no flash); a DB theme has no SSR alt-block, so when the
// `adh-theme` cookie names one we fetch the live set, apply its base seed, then layer
// its concatenated free-form CSS. Dev-only: the ALT_STYLE_SELECTOR presence check makes
// this inert in production (no alt blocks → return early → no fetch). Renders nothing.
export function DbThemeApplier() {
  useEffect(() => {
    if (!document.querySelector(ALT_STYLE_SELECTOR)) return
    const key = readStoredTheme()
    if (!key || isSwitcherSeed(key)) return // unset or a seed → pre-paint already handled it
    let cancelled = false
    void listThemes()
      .then((rows) => {
        if (cancelled) return
        const t = rows.find((r) => r.key === key)
        if (!t) return
        applyBaseTheme(isSwitcherSeed(t.basedOn) ? t.basedOn : DEFAULT_ADH_THEME)
        applyThemeCss(concatItemCss(t.data))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
