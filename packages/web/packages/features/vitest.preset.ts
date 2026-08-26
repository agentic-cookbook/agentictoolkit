import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import { adtAlias, adtInline } from '../../vitest.adt'

// Single source of the feature-package vitest config (DRY). Self-contained so
// `pnpm --filter @agentic-toolkit/<pkg> run test` (cwd = the package) discovers
// src/**/*.test.tsx — the workspace-root config's `dir: '../packages'` resolves
// outside the web workspace and finds nothing. Reuses the root setup file for its
// ResizeObserver / localStorage / matchMedia shims (jsdom doesn't provide them).
//
// A per-package vitest.config.ts is one line: the default export of
// `featureVitest()`. Packages that ship no unit tests yet pass `{ passWithNoTests:
// true }` so an empty suite doesn't fail the per-package lane.
//
// `setupFiles` adds a package's OWN setup after the shared one. It exists because the
// root file can only reach dependency-free shims: it lives at the workspace root,
// which has no `@agentic-toolkit/*` in scope, so anything that must reset a toolkit
// package's module-scope state (the query cache — see `vitest.setup.ts` next to any
// config that passes this) has to be imported from inside the package that depends on it.
export function featureVitest(
  opts: { passWithNoTests?: boolean; setupFiles?: string[] } = {},
) {
  // The consuming package's directory. `process.cwd()` is not a guess here: this
  // preset already requires cwd to BE the package (that is what makes `dir: 'src'`
  // find anything), because a per-package config is only ever loaded by that
  // package's own `test` script. Asserting it keeps a wrong cwd from silently
  // producing an alias map built from the wrong manifest.
  const packageDir = process.cwd()
  if (!existsSync(join(packageDir, 'package.json'))) {
    throw new Error(
      `featureVitest: expected the cwd to be the package being tested, but ` +
        `${packageDir} has no package.json. Run this through the package's own ` +
        `\`test\` script (pnpm --filter <pkg> run test).`,
    )
  }

  return defineConfig({
    resolve: {
      // ONE React (and one of everything else the linked toolkit needs) in the
      // test process. `@agenticdevelopertoolkit/*` is a SEPARATE pnpm workspace
      // reached by `link:`, with a node_modules of its own, and vite resolves a
      // symlinked file by its REAL path — so a bare `react` inside toolkit source
      // resolves from THERE unless the consumer pins it. See ../../vitest.adt.ts
      // for the full reasoning and for why the helper throws rather than skipping.
      alias: adtAlias(packageDir),
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['../../../vitest.setup.ts', ...(opts.setupFiles ?? [])],
      dir: 'src',
      passWithNoTests: opts.passWithNoTests ?? false,
      server: {
        // Aliases only apply to modules vite processes. Deps resolved out of
        // another workspace are externalized by default and Node-resolve on their
        // own, so the alias never sees them.
        deps: { inline: adtInline },
      },
    },
  })
}
