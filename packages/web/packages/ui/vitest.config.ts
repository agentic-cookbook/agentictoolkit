import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/ui run test`
// (cwd = this package) discovers src/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic jest-dom/localStorage/
// ResizeObserver/matchMedia shims (see packages/web/vitest.setup.ts, and the
// @agentic-toolkit/auth package for the same pattern), plus a package-local
// setup for the @base-ui/react Dialog getComputedStyle patch this package's
// dialog-based components (AlertModal, Combobox, DropdownMenu, ...) need.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts', './vitest.setup.ts'],
    dir: 'src',
  },
})
