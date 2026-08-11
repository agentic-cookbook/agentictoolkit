import { defineConfig } from 'vitest/config'

// Self-contained so `pnpm --filter @agentic-toolkit/editing run test` (cwd = this
// package) discovers src/__tests__/*. The workspace-root config's `dir: '../packages'`
// resolves outside the web workspace, so it finds nothing. The root setup file
// supplies the deterministic jsdom shims (jest-dom, localStorage, ResizeObserver,
// matchMedia); the package-local one patches getComputedStyle for the @base-ui
// Dialog that AlertModal is built on.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts', './vitest.setup.ts'],
    dir: 'src',
  },
})
