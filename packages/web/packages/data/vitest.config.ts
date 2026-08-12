import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/data run test`
// (cwd = this package) discovers src/**/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic localStorage shim (Node's
// built-in localStorage otherwise interferes with jsdom).
//
// `./vitest-setup.ts` is this package's OWN teardown — it clears the module-scope query client
// between tests. Consumers get it by path (`featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })`),
// and the package that owns the client has to load it too, or the hooks' own tests are the only
// ones in the workspace running against a cache that survives from one test into the next.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts', './vitest-setup.ts'],
    dir: 'src',
  },
})
