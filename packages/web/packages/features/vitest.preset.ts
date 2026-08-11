import { defineConfig } from 'vitest/config'

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
  return defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['../../../vitest.setup.ts', ...(opts.setupFiles ?? [])],
      dir: 'src',
      passWithNoTests: opts.passWithNoTests ?? false,
    },
  })
}
