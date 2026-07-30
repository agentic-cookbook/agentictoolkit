'use client'

import {
  DebugConsoleWindow as ToolkitDebugConsoleWindow,
  type EnvOverrideSurface,
} from '@agentic-toolkit/adh/debug-env'

// PRESERVED IMPORTS — the package path, never a relative one. This package's tsup is a
// bundling build with `splitting: false`, so a relative specifier would inline a PRIVATE
// copy of the target's module state into this entry: a second `envOverride` listener set
// (the header would stop reacting to the console's env switch) and a second copy of the
// theme taxonomy. Both subpaths are listed in tsup.config.ts's `external`; both halves
// are required. These were cross-package specifiers while the console lived in
// the former `@adh/chrome` and became SELF-references on the way in — exactly the shape that
// silently forks state, so they stay full package paths. See src/concepts/index.ts for
// the same note on `concepts/participating`.
import {
  useEnvOverride,
  setEnvOverride,
  parseEnvOverride,
} from '@agentic-toolkit/adh/header'
import { themeAreasSurface } from '@agentic-toolkit/adh/theme-editor'

/**
 * adh's Debug console — the toolkit's generic console wired to adh's own environment
 * store and theme taxonomy.
 *
 * WHY THIS MODULE EXISTS. The console is MECHANISM and lives in the toolkit; the two
 * things it renders are adh VOCABULARY and live here. Something has to join them, and it
 * has to be a module the site menu can `next/dynamic`-import BY PACKAGE PATH: the menu
 * sits in the always-loaded `header/index` entry, so importing the taxonomy (and, through
 * `CssEditor`, Monaco) from there directly would drag both onto every page. Behind this
 * lazily fetched entry they stay exactly as lazy as they were inside the pre-rename
 * `@adh-shared/adh`,
 * where the same code was one un-split chunk.
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
      themeAreas={themeAreasSurface}
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
