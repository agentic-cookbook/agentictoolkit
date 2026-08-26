import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { adtAlias, adtInline } from '../../vitest.adt'

// Self-contained config so `pnpm --filter @agentic-toolkit/resource run test`
// (cwd = this package) discovers src/**/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its ResizeObserver / localStorage / matchMedia
// shims (jsdom doesn't provide them).
//
// `../data/vitest-setup.ts` empties the toolkit's MODULE-SCOPE query client between tests, the
// same way the feature packages load it. This package needs it for the same reason they do: the
// resource explorer reads through `useResourceList`, so without the teardown a list one test
// loaded is still cached — and still fresh — when the next test renders, whose fetcher is then
// never called and whose rows are the previous test's.
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
    setupFiles: ['../../vitest.setup.ts', '../data/vitest-setup.ts'],
    dir: 'src',
    server: {
      // Aliases only apply to modules vite processes. Deps resolved out of another
      // workspace are externalized by default and Node-resolve on their own, so the
      // alias never sees them.
      deps: { inline: adtInline },
    },
  },
})
