import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/projects run test`
// (cwd = this package) discovers src/**/*.test.tsx. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its ResizeObserver / localStorage / matchMedia
// shims (jsdom doesn't provide them).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../../vitest.setup.ts'],
    dir: 'src',
    // The package ships AccessPane/TokensPanel with no unit tests yet; an empty
    // suite must not fail the per-package test lane (the api-explorer/themes/
    // narratives precedent).
    passWithNoTests: true,
  },
})
