import { defineConfig } from 'vitest/config'

// Self-contained so `pnpm --filter @agentic-toolkit/controls run test` (cwd = this
// package) discovers src/**/__tests__/*. The workspace-root config's `dir: '../packages'`
// resolves outside the web workspace, so it finds nothing — the same reason the `ui`
// and `editing` packages carry their own. The root setup file supplies the deterministic
// jsdom shims (jest-dom, localStorage, ResizeObserver, matchMedia); nothing here is built
// on the @base-ui Dialog, so there is no package-local setup to add to it.
//
// This package's nine test files existed with no way to run them: no `test` script and
// no config, so `pnpm -r --if-present test` skipped it silently and every suite here was
// dead weight that read as coverage.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
  },
})
