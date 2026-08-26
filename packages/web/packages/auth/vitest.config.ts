import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { adtAlias, adtInline } from '../../vitest.adt'

// Self-contained config so `pnpm --filter @agentic-toolkit/auth run test`
// (cwd = this package) discovers src/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic localStorage shim (Node 24's
// built-in localStorage otherwise interferes with jsdom).
export default defineConfig({
  resolve: {
    // ONE React in the test process. This package renders
    // @agenticdevelopertoolkit/* source, which lives in a SEPARATE pnpm workspace
    // reached by `link:` and therefore resolves its own bare `react` from its own
    // store (vite resolves a symlink by its REAL path). See ../../vitest.adt.ts.
    alias: adtAlias(fileURLToPath(new URL('.', import.meta.url))),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
    server: {
      // Aliases only apply to modules vite processes. Deps resolved out of another
      // workspace are externalized by default and Node-resolve on their own, so the
      // alias never sees them.
      deps: { inline: adtInline },
    },
  },
})
