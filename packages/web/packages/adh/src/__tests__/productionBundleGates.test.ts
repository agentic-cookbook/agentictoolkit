/**
 * The mechanism that keeps dev-only theming OUT of a production bundle.
 *
 * Four modules must not exist in a production build — the site-theme console, adh's theme
 * taxonomy (which is what drags in Monaco), the DB-theme applier, and the theme-preview
 * carry helpers — and each is held out by a gate with FOUR legs: a folded env comparison at
 * the import site, a package-subpath specifier, a matching tsup entry + `external`, and a
 * package.json export. Pull any one leg and the code silently ships: the feature still works
 * in dev, production still behaves correctly, and the only trace is a chunk nobody opens.
 * That is exactly how the editor came to be bundled into every production build of every
 * site while the gate above it read `DEV_BUILD ?`.
 *
 * The console and the taxonomy are two gates rather than one because they sit on opposite
 * sides of the package's own tier split: the console is toolkit MECHANISM (src/debug-env)
 * and the taxonomy is adh VOCABULARY (src/theme-editor), joined by an injected loader. Each
 * side has to fold its own import — gating only the console would leave the host building
 * the taxonomy in order to hand it over.
 *
 * So this is a source-and-config test on purpose. The behavioural gates are covered
 * elsewhere (themeSwitcherProductionGate, debugConsoleSiteThemeGate, useSiteMenu) and they
 * all still pass with every leg pulled — bundling is not observable from inside the process.
 * The one check a test cannot make is the bundler's actual output; for that, build a site
 * with NEXT_PUBLIC_DEPLOYMENT_ENV=production and grep .next/static/chunks for `monaco`,
 * `Brand colors` and `data-adh-theme-alt`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { DEV_DEPLOYMENT_ENVS } from '@agentic-toolkit/adh-registry/deployment-env'

const here = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(here, '../..')
/** adh-registry is where the allowlist and DEV_BUILD live — this package depends on it, so
 *  the module can be read from both sides (its own `seo/metadata.ts` needs it too). Reached
 *  as a sibling directory rather than through the specifier because the assertion below is
 *  about the SOURCE TEXT, which a resolved module does not expose. */
const REGISTRY_ROOT = resolve(PKG_ROOT, '../adh-registry')

const read = (rel: string) => readFileSync(resolve(PKG_ROOT, rel), 'utf8')

/**
 * Comments stripped: block comments, and lines that are nothing but a `//` comment. The
 * gates below document the WRONG shapes by name (that is most of their value), so a test
 * hunting for those shapes has to read code only — otherwise the explanation trips it.
 * Deliberately not stripping trailing `//` after code: these files build `https://` URLs.
 */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Collapse formatting so an assertion survives prettier re-wrapping the expression. */
const flat = (text: string) => text.replace(/\s+/g, ' ')

/** tsconfig.json, comments and all. */
const tsconfigPaths = (): Record<string, string[]> =>
  (JSON.parse(code(read('tsconfig.json'))) as { compilerOptions: { paths: Record<string, string[]> } })
    .compilerOptions.paths

/**
 * Where `tsc` lands `specifier` under this package's `paths` — longest matching prefix wins,
 * exactly as TypeScript resolves them, which is what lets a wildcard and an override coexist.
 * `null` when nothing matches at all.
 */
const tsResolves = (specifier: string): string | null => {
  let best: string | null = null
  let bestPrefix = -1
  for (const [pattern, targets] of Object.entries(tsconfigPaths())) {
    // tsc tries each target in order and takes the first that exists; every mapping in this
    // package has exactly one, and a second would mean a fallback the gates must not have.
    const target = targets[0]
    if (target === undefined) continue
    const star = pattern.indexOf('*')
    if (star === -1) {
      if (pattern === specifier && pattern.length > bestPrefix) {
        bestPrefix = pattern.length
        best = target
      }
      continue
    }
    const prefix = pattern.slice(0, star)
    const suffix = pattern.slice(star + 1)
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue
    if (prefix.length <= bestPrefix) continue
    bestPrefix = prefix.length
    best = target.replace('*', specifier.slice(prefix.length, specifier.length - suffix.length))
  }
  return best
}

/** Module identity, ignoring the two spellings of the same file: a directory and its
 *  `index`, and an extension tsc supplies for itself. `./src/x`, `./src/x/index.ts` and
 *  `./src/x.tsx` are what a `paths` target, an entry key and a source path each call the
 *  same module. */
const strip = (path: string | null) =>
  (path ?? '').replace(/\/index\.tsx?$/, '').replace(/\.tsx?$/, '')

/**
 * The one form the bundler can fold: a comparison per dev env, against string literals,
 * written out at the gate site. Derived from DEV_DEPLOYMENT_ENVS so adding a dev env fails
 * every gate that hasn't been updated rather than silently gating it out.
 */
const FOLDABLE = DEV_DEPLOYMENT_ENVS.map(
  (env) => `process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === '${env}'`,
).join(' || ')

/** A dev-only module, the gate site that must exclude it, and the wiring that makes the
 *  module boundary survive the dist build. `subpath` is what the specifier and the exports
 *  map say; `entry` is what tsup and the built `dist/` say. They differ for a DIRECTORY
 *  subpath, whose entry key carries the `/index` the specifier does not — so both are
 *  spelled out per row rather than derived. */
const GATES = [
  {
    what: 'the site-theme console (theme-editor state, the persistence client)',
    gate: 'src/debug-env/DebugConsole.tsx',
    subpath: 'debug-env/SiteThemeConsole',
    entry: 'debug-env/SiteThemeConsole',
    source: 'src/debug-env/SiteThemeConsole.tsx',
  },
  {
    what: "adh's theme taxonomy, and through its CssEditor the whole of Monaco",
    // The console's own chunk is NOT gated — a signed-in admin opens it in production (see
    // the next/dynamic in header/SiteMenu.tsx) — so the taxonomy the host injects into it
    // needs a gate of its own, one level up from the gate above. Lazy is not absent.
    gate: 'src/debug-console/index.tsx',
    subpath: 'theme-editor',
    entry: 'theme-editor/index',
    source: 'src/theme-editor/index.ts',
  },
  {
    what: 'the DB-theme applier (also the only "use client" module in the themes graph)',
    gate: 'src/themes/AdhThemeStyle.tsx',
    subpath: 'themes/DbThemeApplier',
    entry: 'themes/DbThemeApplier',
    source: 'src/themes/DbThemeApplier.tsx',
  },
  {
    what: 'the cross-site theme-preview carry helpers',
    gate: 'src/header/useSiteMenu.ts',
    subpath: 'themes/theme-preview',
    entry: 'themes/theme-preview',
    source: 'src/themes/theme-preview.ts',
  },
  {
    what: "the User Settings appearance panel's dev-only theme picker row",
    gate: 'src/settings/AppearancePanel.tsx',
    subpath: 'settings/ThemePickerRow',
    entry: 'settings/ThemePickerRow',
    source: 'src/settings/ThemePickerRow.tsx',
  },
] as const

describe('production bundle gates', () => {
  it('states the foldable comparison in the only form that folds', () => {
    // Guards the guard: if this stops matching what the gates below contain, every
    // assertion in this file goes vacuous while still passing.
    expect(FOLDABLE).toBe(
      "process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' || " +
        "process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' || " +
        "process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'",
    )
  })

  it('defines DEV_BUILD from the same allowlist, in the same foldable form', () => {
    // DEV_BUILD is the runtime half of the same fact. It is not a chunk gate (an importer
    // reads an identifier, which the bundler will not fold through), but it must agree.
    expect(
      flat(readFileSync(resolve(REGISTRY_ROOT, 'src/deployment-env.ts'), 'utf8')),
    ).toContain(FOLDABLE)
  })

  describe.each(GATES)('$subpath — $what', ({ gate, subpath, entry, source }) => {
    const specifier = `@agentic-toolkit/adh/${subpath}`

    it('gates it on a folded comparison, never on an identifier', () => {
      const src = flat(code(read(gate)))
      const chains = src.split(FOLDABLE).length - 1
      expect(chains, `${gate} has no foldable gate`).toBeGreaterThan(0)

      // Every mention of the build var belongs to a complete chain — a lone comparison
      // (`=== 'production'`, or one env dropped) would fold to the wrong answer for some env.
      const mentions = src.split('process.env.NEXT_PUBLIC_DEPLOYMENT_ENV').length - 1
      expect(mentions, `${gate} mentions the build env outside a full comparison chain`).toBe(
        chains * DEV_DEPLOYMENT_ENVS.length,
      )

      // The shape that looks like a gate and isn't: DEV_BUILD is an identifier, so the
      // bundler keeps the branch — and with it everything the import pulls in.
      expect(src, `${gate} guards a dynamic import with DEV_BUILD`).not.toMatch(
        /DEV_BUILD \? dynamic\(/,
      )
    })

    it('imports it by package subpath, never relatively', () => {
      const src = code(read(gate))
      expect(src, `${gate} does not import ${specifier}`).toContain(`'${specifier}'`)

      // A relative VALUE import of the same module defeats the whole thing: esbuild inlines
      // it into this bundle (splitting: false), boundary and all. Type-only imports are
      // erased before any bundler sees them, so a relative `import type` is fine and
      // DebugConsole.tsx uses one (LeaveGuardRef). debugConsoleSiteThemeGate.test.ts is
      // where the value-vs-type distinction is pinned down properly.
      const values = src.replace(/^import\s+type\s[\s\S]*?from\s*'[^']*'/gm, '')
      const leaf = subpath.slice(subpath.lastIndexOf('/') + 1)
      expect(values, `${gate} still imports ${leaf} by relative path`).not.toMatch(
        new RegExp(`from '\\.[^']*/${leaf}'|import\\('\\.[^']*/${leaf}'\\)`),
      )
    })

    it('is its own tsup entry, kept un-inlined by a matching external', () => {
      const cfg = flat(read('tsup.config.ts'))
      expect(cfg, `tsup has no '${entry}' entry`).toContain(`'${entry}': '${source}'`)
      expect(cfg, `tsup does not keep ${specifier} external`).toContain(`'${specifier}',`)
    })

    it('is exported from package.json, so a consumer can resolve the subpath', () => {
      const exports = (
        JSON.parse(read('package.json')) as { exports: Record<string, Record<string, string>> }
      ).exports
      const condition = exports[`./${subpath}`]
      expect(condition, `package.json does not export ./${subpath}`).toBeTruthy()
      expect(condition?.import).toBe(`./dist/${entry}.js`)
      expect(condition?.types).toBe(`./dist/${entry}.d.ts`)
      // `development` points at source (the local suite resolves it); it has to be the very
      // module the tsup entry builds, or dev and prod load different code.
      expect(condition?.development).toBe(`./${source}`)
    })

    it('resolves for typecheck without a built dist', () => {
      // tsc has no self-reference to this package, so every subpath has to land on source
      // through `paths`. Without that, `tsc --noEmit` either fails (TS2307) or silently
      // resolves to a stale dist and types the lazy component as `{}` — which typechecks
      // any props at all.
      //
      // Asserted as "wherever tsc lands" rather than as one exact key, because both
      // spellings are correct and which one a subpath needs is not this test's business:
      // most are served by the `@agentic-toolkit/adh/*` wildcard, and only the handful whose
      // default-export type must be known at a `next/dynamic` call site carry an override.
      const resolved = tsResolves(specifier)
      expect(strip(resolved), `${specifier} resolves to ${resolved ?? 'nothing'}`).toBe(
        strip(`./${source}`),
      )
    })
  })
})
