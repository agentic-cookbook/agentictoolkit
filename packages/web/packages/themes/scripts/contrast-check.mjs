#!/usr/bin/env node
// WCAG AA contrast gate for generated theme CSS (per the cookbook's color.md /
// theming-with-tokens.md). Resolves the M3 role var() chains in each generated
// theme to literal colors and asserts every text/background and UI pair meets
// 4.5:1 (normal text) or 3:1 (large text + non-text UI). Exits non-zero on any
// failure so CI fails fast. Run: node scripts/contrast-check.mjs [--report]
import { readFile } from 'node:fs/promises'

const REPORT_ONLY = process.argv.includes('--report')
const THEMES = ['adh', 'adh-manrope'] // share one color layer; check both anyway

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

let failures = 0
for (const theme of THEMES) {
  const css = await readFile(new URL(`../src/styles/${theme}.css`, import.meta.url), 'utf8')
  const map = parseVars(css)
  console.log(`\n${theme}`)
  for (const [fgName, bgName, min, label] of PAIRS) {
    const fg = resolve(fgName, map)
    const bg = resolve(bgName, map)
    const r = fg && bg ? ratio(fg, bg) : null
    if (r == null) {
      console.log(`  ?? ${label}: could not resolve ${fgName}/${bgName}`)
      failures++
      continue
    }
    const ok = r >= min
    if (!ok) failures++
    const tag = ok ? 'ok ' : 'FAIL'
    console.log(`  ${tag} ${r.toFixed(2)}:1 (min ${min}) — ${label}  [${fg} on ${bg}]`)
  }
}

if (failures > 0) {
  console.log(`\n${failures} contrast issue(s).`)
  if (!REPORT_ONLY) process.exit(1)
} else {
  console.log('\nAll pairs pass WCAG AA.')
}
