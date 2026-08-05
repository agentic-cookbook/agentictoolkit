#!/usr/bin/env node
// WCAG AA contrast gate for generated theme CSS (per the cookbook's color.md /
// theming-with-tokens.md). Resolves the M3 role var() chains in each generated
// theme to literal colors and asserts every text/background and UI pair meets
// 4.5:1 (normal text) or 3:1 (large text + non-text UI). Exits non-zero on any
// failure so CI fails fast. Run: node scripts/contrast-check.mjs [--report]
import { readdir, readFile } from 'node:fs/promises'

const REPORT_ONLY = process.argv.includes('--report')
// adh-family themes share one dark `:root` color layer (check both anyway). Full-palette
// themes ship their OWN complete M3 palette in dual blocks — a dark `html:root` and a light
// `html:root[data-color-mode]:not(.dark)` override — so each is gated in BOTH modes.
const ADH_THEMES = ['adh', 'adh-manrope']

const STYLES_DIR = new URL('../src/styles/', import.meta.url)
const DARK_SELECTOR = 'html:root'
const LIGHT_SELECTOR = 'html:root[data-color-mode]:not(.dark)'

/**
 * Index of the rule whose selector LIST contains `selector` as a whole entry, or -1.
 *
 * Matching the literal `<selector> {` instead is what let the family's own default ship
 * ungated: a dark-ALWAYS theme deliberately points its dark and its light selectors at
 * ONE rule (`html:root, html:root[data-color-mode]:not(.dark), … {`), so the substring
 * `html:root {` never appears in it and discovery below skipped the file outright — the
 * exact hand-maintained-roster failure the comment there warns about, arrived at through
 * a selector's shape rather than a list. An entry must therefore END at a `,` or the `{`,
 * or the bare `html:root` probe would also match the front of `html:root[data-…]`.
 */
function selectorAt(css, selector) {
  const lit = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.search(new RegExp(String.raw`(?:^|,)\s*${lit}\s*(?:,|\{)`, 'm'))
}

// DISCOVERED, never listed. Carrying a second hand-maintained roster here is what let the
// 13 converted legacy themes ship ungated: they were added to the manifest and to the
// switcher, and this file — the only thing that would have caught their contrast — kept
// checking the original 14. A full-palette theme IS a stylesheet with both mode blocks,
// so ask the directory. A new theme is gated the moment it exists.
async function discoverFullPaletteThemes() {
  const found = []
  for (const name of (await readdir(STYLES_DIR)).sort()) {
    if (!name.endsWith('.css')) continue
    const theme = name.slice(0, -4)
    if (ADH_THEMES.includes(theme)) continue
    const css = await readFile(new URL(name, STYLES_DIR), 'utf8')
    if (selectorAt(css, DARK_SELECTOR) >= 0 || selectorAt(css, LIGHT_SELECTOR) >= 0)
      found.push(theme)
  }
  return found
}

const FULL_PALETTE_THEMES = await discoverFullPaletteThemes()

// pairs: [foreground role, background role, minRatio, label]
const TEXT = 4.5
const UI = 3.0
const PAIRS = [
  ['color-on-surface', 'color-surface', TEXT, 'body text'],
  ['color-on-surface-variant', 'color-surface', TEXT, 'secondary text on surface'],
  ['color-on-surface-variant', 'color-surface-container', TEXT, 'secondary text on container'],
  ['color-on-surface-variant', 'color-surface-container-high', TEXT, 'secondary text on container-high'],
  ['color-on-primary', 'color-primary', TEXT, 'on-primary'],
  ['color-on-primary-container', 'color-primary-container', TEXT, 'on-primary-container'],
  ['color-on-secondary', 'color-secondary', TEXT, 'on-secondary'],
  ['color-on-secondary-container', 'color-secondary-container', TEXT, 'on-secondary-container'],
  ['color-on-tertiary', 'color-tertiary', TEXT, 'on-tertiary'],
  ['color-on-tertiary-container', 'color-tertiary-container', TEXT, 'on-tertiary-container'],
  ['color-on-error', 'color-error', TEXT, 'on-error'],
  ['color-on-error-container', 'color-error-container', TEXT, 'on-error-container'],
  ['color-on-success', 'color-success', TEXT, 'on-success'],
  ['color-on-success-container', 'color-success-container', TEXT, 'on-success-container'],
  ['color-on-warning', 'color-warning', TEXT, 'on-warning'],
  ['color-on-warning-container', 'color-warning-container', TEXT, 'on-warning-container'],
  ['color-on-info', 'color-info', TEXT, 'on-info'],
  ['color-on-info-container', 'color-info-container', TEXT, 'on-info-container'],
  // foreground-as-accent / status text on the base surface (used as colored text/icons)
  ['color-primary', 'color-surface', UI, 'primary as text/UI on surface'],
  ['color-error', 'color-surface', UI, 'error text/UI on surface'],
  ['color-success', 'color-surface', UI, 'success text/UI on surface'],
  ['color-info', 'color-surface', UI, 'info text/UI on surface'],
  // Focus ring is the WCAG 1.4.11 state indicator that MUST be perceivable (3:1).
  // The resting --color-outline border is intentionally subtle (~1.4:1) and is
  // exempt from 1.4.11: it is decorative, not the sole boundary signal — cards /
  // inputs also separate by surface-tier background and use the accent on
  // focus/active. So we gate the focus ring, not the resting border.
  ['focus-ring-color', 'color-surface', UI, 'focus ring on surface'],
  ['focus-ring-color', 'color-surface-container', UI, 'focus ring on container'],
]

function parseVars(css) {
  const map = new Map()
  const re = /^\s*(--[\w-]+):\s*([^;]+);/gm
  let m
  while ((m = re.exec(css))) map.set(m[1].trim().replace(/^--/, ''), m[2].trim())
  return map
}
function resolve(name, map, depth = 0) {
  if (depth > 30 || !map.has(name)) return null
  let v = map.get(name)
  const ref = v.match(/^var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)$/)
  if (ref) return resolve(ref[1], map, depth + 1)
  return v
}
function toRgb(color) {
  color = color.trim()
  let m = color.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  m = color.match(/^#([0-9a-f]{3})$/i)
  if (m) {
    const h = m[1]
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]
  }
  m = color.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  return null
}
function composite(fg, bg) {
  // alpha-composite fg over bg (bg assumed opaque)
  const a = fg[3]
  return [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)))
}
function relLum([r, g, b]) {
  const f = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(fgColor, bgColor) {
  const bg = toRgb(bgColor)
  let fg = toRgb(fgColor)
  if (!fg || !bg) return null
  if (fg[3] < 1) fg = composite(fg, bg)
  const L1 = relLum(fg.slice(0, 3))
  const L2 = relLum(bg.slice(0, 3))
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}

/** Body of the first rule listing `selector` (token blocks have no nested braces). A
 *  selector cannot contain a brace, so the next `{` still opens the rule even when the
 *  matched entry is followed by more selectors in the list. */
function blockBody(css, selector) {
  const at = selectorAt(css, selector)
  if (at < 0) return null
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return close < 0 ? null : css.slice(open + 1, close)
}

// Build the list of (label, varMap) targets to gate. adh-family: one dark map from the
// whole file. Full-palette: a dark map (its `html:root` block) and a light map (dark with
// the `html:root[data-color-mode]:not(.dark)` block layered on top — it overrides only the
// colors that change between modes), so both modes are checked against the same M3 pairs.
// A dark-ALWAYS theme lists both selectors on one rule, so the two maps come out equal and
// it is gated twice on the same palette — which is the truth about it, not a redundancy.
const targets = []
for (const theme of ADH_THEMES) {
  const css = await readFile(new URL(`../src/styles/${theme}.css`, import.meta.url), 'utf8')
  targets.push({ label: theme, map: parseVars(css) })
}
for (const theme of FULL_PALETTE_THEMES) {
  const css = await readFile(new URL(`${theme}.css`, STYLES_DIR), 'utf8')
  const darkBody = blockBody(css, 'html:root')
  const lightBody = blockBody(css, 'html:root[data-color-mode]:not(.dark)')
  if (darkBody == null || lightBody == null) {
    console.log(`\n${theme}\n  ?? missing html:root dark/light block — cannot gate`)
    // Counted as a failure below via the empty-map path.
  }
  const darkMap = parseVars(darkBody ?? '')
  const lightMap = new Map(darkMap)
  for (const [k, v] of parseVars(lightBody ?? '')) lightMap.set(k, v)
  targets.push({ label: `${theme} (dark)`, map: darkMap })
  targets.push({ label: `${theme} (light)`, map: lightMap })
}

let failures = 0
for (const { label, map } of targets) {
  console.log(`\n${label}`)
  for (const [fgName, bgName, min, pairLabel] of PAIRS) {
    const fg = resolve(fgName, map)
    const bg = resolve(bgName, map)
    const r = fg && bg ? ratio(fg, bg) : null
    if (r == null) {
      console.log(`  ?? ${pairLabel}: could not resolve ${fgName}/${bgName}`)
      failures++
      continue
    }
    const ok = r >= min
    if (!ok) failures++
    const tag = ok ? 'ok ' : 'FAIL'
    console.log(`  ${tag} ${r.toFixed(2)}:1 (min ${min}) — ${pairLabel}  [${fg} on ${bg}]`)
  }
}

if (failures > 0) {
  console.log(`\n${failures} contrast issue(s).`)
  if (!REPORT_ONLY) process.exit(1)
} else {
  console.log('\nAll pairs pass WCAG AA.')
}
