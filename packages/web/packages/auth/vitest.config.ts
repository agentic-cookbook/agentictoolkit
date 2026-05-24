import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/auth run test`
// (cwd = this package) discovers src/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic localStorage shim (Node 24's
// built-in localStorage otherwise interferes with jsdom).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
  },
})
