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
    // The gate runs `pnpm -r --if-present test`, which starts a vitest worker POOL PER PACKAGE
    // across the whole workspace at once — and the gate's lanes now run concurrently too, so the
    // machine is oversubscribed while this pool runs. A worker here can be starved of CPU for
    // seconds at a stretch. That is not a slow test, it is a descheduled one, and the default 5 s
    // budget is narrow enough to lose the race: `guard.test.tsx`'s "is clear once the work is
    // saved" timed out at 5 005 ms under the full gate, and the whole 11-test file finishes in
    // 242 ms of test time run on its own. A ceiling costs nothing when it is not hit, so raise it
    // for the package rather than for the one test that happened to be descheduled this time; the
    // next one would otherwise be a fresh flake with the same cause. Same reason and same number
    // as packages/adh and packages/markdown.
    testTimeout: 30_000,
  },
})
