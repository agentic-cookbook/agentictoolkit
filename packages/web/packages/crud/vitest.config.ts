import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/crud run test`
// (cwd = this package) discovers src/__tests__/* (the workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing —
// see the @agentic-toolkit/ui and @agentic-toolkit/auth packages for the same
// pattern). We reuse the root setup file for its deterministic jest-dom/
// localStorage/ResizeObserver/matchMedia shims.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
  },
})
