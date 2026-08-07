#!/usr/bin/env node
// Builds the DTCG token source in tokens/ into per-theme CSS variable files in
// src/styles/<theme>.css via Style Dictionary. Primitives are filtered out of the
// output (resolution-only) so only Tier-2/3 tokens emit; semantic->semantic refs stay
// as var(), semantic->primitive refs inline their value (outputReferencesFilter).
//
// Output is AUTO-GENERATED — never hand-edit src/styles/adh*.css. Edit tokens/ instead.
import { readFileSync, statSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import StyleDictionary from 'style-dictionary'
import { formattedVariables, outputReferencesFilter } from 'style-dictionary/utils'

// The self-hosted Iosevka manifest — faces, measured metrics, and the metric-matched
// fallback overrides — written by scripts/subset-fonts.py. See fontFaceBlock below.
const FONTS = JSON.parse(readFileSync(new URL('../src/fonts/metrics.json', import.meta.url)))

/**
 * The `@font-face` preamble for a theme that uses the SELF-HOSTED Iosevka subset.
 *
 * This replaces what used to be three `@import url('https://cdn.jsdelivr.net/…')`
 * lines, and it is the fix for "the font changes size after the initial load":
 *
 *  - **Self-hosted.** An `@import` in an inlined <style> becomes a second stylesheet
 *    request to a THIRD-PARTY origin, and the woff2 inside it is only discoverable
 *    once that stylesheet has arrived and parsed — a connect + two chained round
 *    trips before the first font byte. These faces sit on the site's own origin, on
 *    the connection that already delivered the HTML, and `AdhThemeStyle` preloads
 *    the two that carry layout.
 *  - **Metric-matched fallback.** `font-display: swap` guarantees the first paint is
 *    in a fallback, so the fallback has to be the RIGHT SIZE or the swap re-flows the
 *    page. Iosevka is monospace at a flat 0.5 em advance; `ui-monospace` resolves to
 *    SF Mono at 0.618 em, so body text used to arrive 24% wider than it ends up.
 *    Because BOTH faces are monospaced, one advance describes the whole face, so
 *    `size-adjust` is an EXACT correction rather than the usual approximation — the
 *    fallback lays out at Iosevka's own metrics and the swap moves nothing.
 *
 * The numbers all come from `metrics.json`, measured off the built subset by
 * subset-fonts.py, so they cannot drift from the font they describe.
 */
function fontFaceBlock() {
  // `unicode-range` is what splits each weight into the preloaded CORE cut and the
  // lazily-fetched EXT one (see SUBSETS in subset-fonts.py). The ranges are DISJOINT and
  // spelled out on both, deliberately: a face with no `unicode-range` claims U+0-10FFFF,
  // which would make the browser fetch the core face to paint a page of pure Cyrillic and
  // leave the two cuts fighting over the cascade instead of dividing the alphabet.
  const faces = FONTS.faces.map(
    ({ file, weight, style, unicodeRange }) => `@font-face {
  font-family: '${FONTS.family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('${FONTS.publicPath}/${file}') format('woff2');
  unicode-range: ${unicodeRange};
}`,
  )
  // One STACKED family per fallback (not two faces of one family): a family whose
  // every `local()` misses is simply unavailable, so the stack falls through
  // deterministically to the next entry in --font-*.
  const fallbacks = FONTS.fallbacks.map(
    ({ family, locals, sizeAdjust, ascentOverride, descentOverride, lineGapOverride }) => `@font-face {
  font-family: '${family}';
  src: ${locals.map((l) => `local('${l}')`).join(', ')};
  size-adjust: ${sizeAdjust}%;
  ascent-override: ${ascentOverride}%;
  descent-override: ${descentOverride}%;
  line-gap-override: ${lineGapOverride}%;
}`,
  )
  return [...faces, ...fallbacks].join('\n\n')
}

// Themes generated from DTCG (others remain hand-written until migrated). Font sources
// are not tokens, so they live here and are emitted as the file preamble: `fontFaces`
// for the self-hosted subset (see fontFaceBlock), `fontImports` for the themes still on
// a hosted stylesheet. Only the adh-family Iosevka themes are self-hosted — the rest are
// dev-only switcher themes that no production site ships, so the extra ~236 KB of
// committed woff2 per family would buy nothing.
const THEMES = {
  adh: {
    header:
      'Agentic Developer Hub — default theme. Charcoal surface, warm gold accent. Dark-only. Iosevka for all three roles (sans/serif/mono), self-hosted from src/fonts/.',
    fontFaces: true,
  },
  'adh-manrope': {
    header: 'ADH · Manrope — ADH palette with the shipping Manrope / Instrument Serif / DM Mono triple.',
    fontImports: [
      'https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600;700&display=swap',
    ],
  },
  'adh-comic': {
    header: 'ADH · Comic — ADH palette with Comic Neue for sans/serif/mono.',
    fontImports: [
      'https://fonts.googleapis.com/css2?family=Comic+Neue:ital,wght@0,300;0,400;0,700;1,400;1,700&display=swap',
    ],
  },
  'adh-courier': {
    header: 'ADH · Courier — ADH palette with Courier Prime for sans/serif/mono.',
    fontImports: [
      'https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap',
    ],
  },
  'adh-fira': {
    header: 'ADH · Fira — ADH palette with Fira Code for sans/serif/mono.',
    fontImports: ['https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&display=swap'],
  },
  'adh-iosevka': {
    header: 'ADH · Iosevka — same palette as adh.css, explicit Iosevka triple.',
    fontFaces: true,
  },
  'adh-jetbrains': {
    header: 'ADH · JetBrains — ADH palette with JetBrains Mono for sans/serif/mono.',
    fontImports: [
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400;1,700&display=swap',
    ],
  },
  'adh-dev-preview': {
    header:
      'ADH · Dev Preview — copy of adh-manrope swept to JetBrains Mono for every role: the chrome (sans/serif/mono) AND the adh chat theme (--pc-font follows font.sans). The persona-toolkit prebaked chat themes are untouched.',
    fontImports: [
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400;1,700&display=swap',
    ],
  },
}

// Base CSS appended to every theme file (references the semantic/compat tokens above).
const BASE_CSS = `:where(body) {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  font-size: 15px;
}

::selection {
  background: var(--color-accent-dim);
  color: var(--color-accent);
}`

// Map a typography sub-token prop to its CSS declaration.
const TYPE_PROP_TO_CSS = {
  font: 'font-family',
  size: 'font-size',
  'line-height': 'line-height',
  weight: 'font-weight',
  tracking: 'letter-spacing',
  transform: 'text-transform',
}

// Build `.text-<role>` utility classes from the type.* tokens in the dictionary.
function buildTypeClasses(dictionary) {
  const roles = new Map()
  for (const token of dictionary.allTokens) {
    if (token.path[0] !== 'type') continue
    const role = token.path[1]
    const prop = token.path[2]
    if (!TYPE_PROP_TO_CSS[prop]) continue
    if (!roles.has(role)) roles.set(role, [])
    roles.get(role).push({ css: TYPE_PROP_TO_CSS[prop], name: token.name })
  }
  const out = []
  for (const [role, decls] of roles) {
    const body = decls.map((d) => `  ${d.css}: var(--${d.name});`).join('\n')
    out.push(`.text-${role} {\n${body}\n}`)
  }
  return out.join('\n\n')
}

StyleDictionary.registerFormat({
  name: 'adh/theme-css',
  format: ({ dictionary, options }) => {
    const { selector = ':root', fontImports = [], fontFaces = false, header = '' } = options
    const vars = formattedVariables({
      format: 'css',
      dictionary,
      outputReferences: options.outputReferences,
      usesDtcg: true,
      formatting: { indentation: '  ' },
    })
    const importBlock = fontFaces
      ? fontFaceBlock()
      : fontImports.map((u) => `@import url('${u}');`).join('\n')
    const classes = buildTypeClasses(dictionary)
    return [
      `/* ${header} */`,
      '/* AUTO-GENERATED by scripts/build-tokens.mjs from tokens/ — do not edit. */',
      '',
      importBlock,
      '',
      `${selector} {`,
      vars,
      '}',
      '',
      BASE_CSS,
      '',
      classes,
      '',
    ].join('\n')
  },
})

const isPrimitive = (token) => token.filePath.replace(/\\/g, '/').endsWith('tokens/primitives.json')

// Style Dictionary rewrites its destination unconditionally, so a run that changes NOTHING
// still stamps a fresh mtime on every src/styles/*.css. That is not cosmetic. Those files
// are inputs to this package's bundle, and `dist_staleness()` in adh's tools/shared_vendor.py
// reads "a source file newer than the newest thing in dist/" as "this dist is a rollback" —
// the guard that caught b892a088a shipping a status container that died on an ESM
// SyntaxError. adh's ci.yml runs this script (via `check:drift`) AFTER build_shared_deps.py
// has built dist/, so an unconditional rewrite made both backends' vendored-freshness
// checks fail on a tree where not one byte had drifted.
//
// So: snapshot the outputs, and hand back the original mtime to any file the build
// reproduced byte-for-byte. Content behaviour is unchanged — `check:drift`'s
// `git diff --exit-code` still fires on a real change, because a real change is written.
// Paths are cwd-relative to match `buildPath` below; both must name the same files.
const OUT_DIR = 'src/styles'
const snapshot = new Map()
for (const key of Object.keys(THEMES)) {
  const file = join(OUT_DIR, `${key}.css`)
  try {
    snapshot.set(file, { text: readFileSync(file, 'utf8'), stat: statSync(file) })
  } catch {
    // A theme with no output yet is a first build — nothing to preserve.
  }
}

let count = 0
for (const [key, meta] of Object.entries(THEMES)) {
  const sd = new StyleDictionary({
    source: [
      'tokens/primitives.json',
      'tokens/semantic/*.json',
      'tokens/component.json',
      `tokens/themes/${key}.json`,
    ],
    platforms: {
      css: {
        transforms: ['name/kebab'],
        buildPath: 'src/styles/',
        files: [
          {
            destination: `${key}.css`,
            format: 'adh/theme-css',
            filter: (token) => !isPrimitive(token),
            options: {
              outputReferences: outputReferencesFilter,
              selector: ':root',
              fontImports: meta.fontImports,
              fontFaces: meta.fontFaces,
              header: meta.header,
            },
          },
        ],
      },
    },
    log: { verbosity: 'default', warnings: 'warn' },
  })
  await sd.buildAllPlatforms()
  count += 1
}

let unchanged = 0
for (const [file, was] of snapshot) {
  if (readFileSync(file, 'utf8') !== was.text) continue
  utimesSync(file, was.stat.atime, was.stat.mtime)
  unchanged += 1
}

console.log(
  `build-tokens: ${count} theme${count === 1 ? '' : 's'} → src/styles/` +
    (unchanged ? ` (${unchanged} unchanged, mtime preserved)` : ''),
)
