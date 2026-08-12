import { defineConfig } from 'vitest/config'

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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts', '../data/vitest-setup.ts'],
    dir: 'src',
  },
})
