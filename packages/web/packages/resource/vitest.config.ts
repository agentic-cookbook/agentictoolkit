import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/resource run test`
// (cwd = this package) discovers src/**/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its ResizeObserver / localStorage / matchMedia
// shims (jsdom doesn't provide them).
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
  },
})
