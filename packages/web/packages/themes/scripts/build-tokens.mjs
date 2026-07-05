#!/usr/bin/env node
// Builds the DTCG token source in tokens/ into per-theme CSS variable files in
// src/styles/<theme>.css via Style Dictionary. Primitives are filtered out of the
// output (resolution-only) so only Tier-2/3 tokens emit; semantic->semantic refs stay
// as var(), semantic->primitive refs inline their value (outputReferencesFilter).
//
// Output is AUTO-GENERATED — never hand-edit src/styles/adh*.css. Edit tokens/ instead.
import StyleDictionary from 'style-dictionary'
import { formattedVariables, outputReferencesFilter } from 'style-dictionary/utils'

// Themes generated from DTCG (others remain hand-written until migrated). Font @import
// URLs are not tokens, so they live here and are emitted as the file preamble.
const THEMES = {
  adh: {
    header:
      'Agentic Developer Hub — default theme. Charcoal surface, warm gold accent. Dark-only. Iosevka for all three roles (sans/serif/mono).',
    fontImports: [
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/400-italic.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/700.css',
    ],
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
    fontImports: [
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/400.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/400-italic.css',
      'https://cdn.jsdelivr.net/npm/@fontsource/iosevka@5.2.5/700.css',
    ],
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
    const { selector = ':root', fontImports = [], header = '' } = options
    const vars = formattedVariables({
      format: 'css',
      dictionary,
      outputReferences: options.outputReferences,
      usesDtcg: true,
      formatting: { indentation: '  ' },
    })
    const importBlock = fontImports.map((u) => `@import url('${u}');`).join('\n')
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

console.log(`build-tokens: ${count} theme${count === 1 ? '' : 's'} → src/styles/`)
