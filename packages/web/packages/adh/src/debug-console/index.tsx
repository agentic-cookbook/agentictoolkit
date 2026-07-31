'use client'

import {
  DebugConsoleWindow as ToolkitDebugConsoleWindow,
  type EnvOverrideSurface,
  type ThemeAreasLoader,
} from '@agentic-toolkit/adh/debug-env'

// PRESERVED IMPORT — the package path, never a relative one. This package's tsup is a
// bundling build with `splitting: false`, so a relative specifier would inline a PRIVATE
// copy of the target's module state into this entry: a second `envOverride` listener set,
// and the header would stop reacting to the console's env switch. The subpath is listed in
// tsup.config.ts's `external`; both halves are required. These were cross-package
// specifiers while the console lived in the former `@adh/chrome` and became SELF-references
// on the way in — exactly the shape that silently forks state, so they stay full package
// paths. See src/concepts/index.ts for the same note on `concepts/participating`.
//
// The theme taxonomy needs the same package path for the same reason, but reaches it
// through a gated `import()` instead — see `themeAreas` below.
import {
  useEnvOverride,
  setEnvOverride,
  parseEnvOverride,
} from '@agentic-toolkit/adh/header'

/**
 * adh's theme taxonomy, behind the chunk gate in `@agentic-toolkit/adh-registry/deployment-env`.
 *
 * A STATIC `import { themeAreasSurface } from '@agentic-toolkit/adh/theme-editor'` is what
 * this used to be, and it silently undid the gate one level up. THIS module's chunk is
 * unconditional — a signed-in adh admin opens the console in production too (see the
 * `next/dynamic` in header/SiteMenu.tsx, which deliberately has no build gate) — so
 * anything it imports eagerly ships in every build. That included `CssEditor`, which
 * imports `@monaco-editor/react` at module scope: ~110 KB of editor in the production
 * bundle of all ~45 sites, reachable by nobody, because the console's own site-theme topic
 * is already build-gated off.
 *
 * All four legs of the gate, in order: comparisons written out INLINE here so webpack folds
 * them while parsing and never registers the import; a package SUBPATH, since tsup builds
 * with `splitting: false` and would inline a relative one; a matching `theme-editor/index`
 * entry and `external` line in tsup.config.ts; and the `./theme-editor` export in
 * package.json. `productionBundleGates.test.ts` checks all four.
 *
 * The production arm rejects rather than returning an empty surface: it is unreachable, and
 * an empty taxonomy would render as a working-looking editor with no areas in it. `DEV_BUILD`
 * folds the same way in `rootTopicsFor`, so the topic that would call this is not offered.
 */
const themeAreas: ThemeAreasLoader =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'
    ? () => import('@agentic-toolkit/adh/theme-editor').then((m) => m.themeAreasSurface)
    : () =>
        Promise.reject(new Error('The site-theme editor is not built into production bundles.'))

/**
 * adh's Debug console — the toolkit's generic console wired to adh's own environment
 * store and theme taxonomy.
 *
 * WHY THIS MODULE EXISTS. The console is MECHANISM and lives in the toolkit; the two
 * things it renders are adh VOCABULARY and live here. Something has to join them, and it
 * has to be a module the site menu can `next/dynamic`-import BY PACKAGE PATH: the menu sits
 * in the always-loaded `header/index` entry, so wiring the two surfaces up from there
 * directly would drag them onto every page. Behind this lazily fetched entry they stay
 * exactly as lazy as they were inside the pre-rename `@adh-shared/adh`, where the same code
 * was one un-split chunk.
 *
 * Lazy is NOT the same as absent, which is the distinction `themeAreas` above turns on:
 * this chunk is built for every env, so the taxonomy (and, through `CssEditor`, Monaco)
 * needs its own build gate on top of the laziness.
 *
 * The props are identical to the toolkit component's minus the two injected surfaces, so
 * the site menu's call site is unchanged.
 */
export function DebugConsoleWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ToolkitDebugConsoleWindow
      open={open}
      onClose={onClose}
      envOverride={ENV_OVERRIDE}
      themeAreas={themeAreas}
    />
  )
}

// Module-level (not rebuilt per render) so the console's `useEnvOverride` prop is a stable
// hook reference. The setter is wrapped rather than passed straight through: the toolkit
// types the value as a plain `string | null` — it must not learn adh's `SiteEnv` union —
// and a `(SiteEnv | null) => void` is not assignable to a `(string | null) => void`
// parameter position. `parseEnvOverride` is the same validator the store's reader uses, so
// an unknown value clears the override rather than persisting a bogus env.
const ENV_OVERRIDE: EnvOverrideSurface = {
  useEnvOverride,
  setEnvOverride: (env) => setEnvOverride(parseEnvOverride(env)),
}
