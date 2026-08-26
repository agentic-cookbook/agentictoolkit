import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { adtAlias, adtInline } from '../../vitest.adt'

// Self-contained config so `pnpm --filter @agentic-toolkit/api-explorer run test`
// (cwd = this package) discovers src/__tests__/* (the workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing —
// see the @agenticdevelopertoolkit/ui and @agentic-toolkit/auth packages for the same
// pattern). No test files exist here yet — the one test this package had
// (the openapi.json drift gate) stays monorepo-side since it needs the spec
// file, which only exists in the websites/ checkout — so `passWithNoTests`
// keeps `test` green rather than failing on an empty suite.
export default defineConfig({
  resolve: {
    // ONE React in the test process — see ../../vitest.adt.ts. Applied here even
    // though the suite is empty today, so the first test added to this package
    // does not have to rediscover the two-stores trap.
    alias: adtAlias(fileURLToPath(new URL('.', import.meta.url))),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
    passWithNoTests: true,
    server: {
      // Aliases only apply to modules vite processes; deps resolved out of another
      // workspace are externalized by default and Node-resolve on their own.
      deps: { inline: adtInline },
    },
  },
})
