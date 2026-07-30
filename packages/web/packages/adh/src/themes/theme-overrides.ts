// The live-preview applier for the theme editor: one managed `<style
// id="adh-theme-edit">` holding the working theme's free-form CSS (the editor's
// per-item blocks, concatenated). Appended to <head> AFTER AdhThemeStyle's default +
// alt blocks, so it wins on equal specificity and re-themes the page instantly with
// no rebuild/fetch. In-session only — the durable applied selection rides the
// `adh-theme` cookie + AdhThemeStyle's alt-blocks across reloads (see theme-preview.ts),
// and DbThemeApplier re-applies a saved DB theme's CSS on load.

import { ALT_STYLE_SELECTOR } from './theme-preview'

const OVERRIDE_ID = 'adh-theme-edit'

// The editor's variable items target `:root` (specificity 0,1,0). Over an adh-family
// base (also `:root`) that wins by source order — the override <style> is appended last.
// But a FULL-PALETTE base defines its vars at `html:root` (0,1,1) and, in light mode,
// `html:root[data-color-mode]:not(.dark)` (0,3,1); both beat a plain `:root` on SPECIFICITY
// regardless of source order, so an unboosted override is silently inert when editing one
// of those themes (edits show no preview change; a saved DB theme basedOn one is dead).
// Raise every top-level `:root` selector in the APPLIED css to `html:root:root:root:root`
// (0,4,1) so it outranks both full-palette blocks in both modes. Only the applied text is
// boosted — the stored/exported/displayed css stays portable `:root`.
const ROOT_SELECTOR_RE = /(^|})(\s*):root(\s*\{)/g
const BOOSTED_ROOT = 'html:root:root:root:root'
function boostRootSpecificity(css: string): string {
  return css.replace(ROOT_SELECTOR_RE, (_m, pre, ws, brace) => `${pre}${ws}${BOOSTED_ROOT}${brace}`)
}

/** Apply a baked seed theme as the BASE by flipping its alt-block to `media="all"`
 *  (the same mechanism the old switcher used). The editor's free-form CSS then layers
 *  on top via {@link applyThemeCss}. No-op on the server / when no alt-blocks exist. */
export function applyBaseTheme(seedKey: string): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLStyleElement>(ALT_STYLE_SELECTOR).forEach((el) => {
    el.media = el.getAttribute('data-adh-theme-alt') === seedKey ? 'all' : 'not all'
  })
}

/** Apply (or replace) the live override with raw CSS. No-op on the server. */
export function applyThemeCss(css: string): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById(OVERRIDE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = OVERRIDE_ID
    document.head.appendChild(el)
  }
  el.textContent = boostRootSpecificity(css)
}

/** Remove the live override, returning the page to its persisted theme. */
export function clearThemeOverride(): void {
  if (typeof document === 'undefined') return
  document.getElementById(OVERRIDE_ID)?.remove()
}
