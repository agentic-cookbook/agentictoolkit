import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/next-config run test`
// (cwd = this package) discovers src/**/*.test.ts. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// This package is pure Node (no DOM, no React) — the default `node` environment is
// correct and no jsdom setup shim is needed.
export default defineConfig({
  test: {
    dir: 'src',
  },
})
