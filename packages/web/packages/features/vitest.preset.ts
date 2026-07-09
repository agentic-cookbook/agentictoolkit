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
export function featureVitest(opts: { passWithNoTests?: boolean } = {}) {
  return defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['../../../vitest.setup.ts'],
      dir: 'src',
      passWithNoTests: opts.passWithNoTests ?? false,
    },
  })
}
