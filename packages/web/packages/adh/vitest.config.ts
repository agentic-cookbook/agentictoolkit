import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Self-contained config so `pnpm --filter @agentic-toolkit/adh run test`
// (cwd = this package) discovers src/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic localStorage shim (Node 24's
// built-in localStorage otherwise interferes with jsdom).
export default defineConfig({
  resolve: {
    // ONE React in the test process. Every `@agentic-toolkit/*` this package renders is a
    // workspace sibling here, so pnpm already hands them the same react from the same store
    // — nothing to pin. `@agenticdevelopertoolkit/*` is the exception: that toolkit is a
    // separate pnpm workspace reached by `link:`, with its own react in its own store, and
    // module resolution starts from the symlink's REAL path. `footerDock.test.tsx` renders
    // its <ThemeStyle> as a CSS oracle; that component happens to be hook-free, so today a
    // second copy is merely wasteful — but the package next door (`ColorModeProvider`, and
    // the chat package's hooks) would fail with `useState of null`, and the failure names
    // React rather than the boundary that caused it. Pin it while the reason is still visible.
    //
    // An alias, not `resolve.dedupe`: dedupe doesn't reach files rooted outside the project,
    // and the persona toolkit lives several directories up and across.
    alias: {
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Two setups. The root one for its deterministic localStorage shim (above); the data
    // package's for the toolkit query cache, which lives at MODULE scope — one per browser tab
    // by design — and therefore outlives `cleanup()`. Any test here that exercises a real
    // resource hook would otherwise read the PREVIOUS test's rows and fail as "my fixture never
    // appeared". Added by path because that file sits inside `packages/`, where the root setup
    // cannot reach it.
    setupFiles: ['../../vitest.setup.ts', '../data/vitest-setup.ts'],
    dir: 'src',
    server: {
      deps: {
        // The alias above only applies to modules vite processes. Deps resolved out of
        // another workspace's store are externalized by default and Node-resolve their own
        // react, so the alias never sees them. Inline the persona toolkit to close that
        // path. Scoped to it alone — inlining the sibling `@agentic-toolkit/*` packages
        // would buy nothing and cost transform time on every run.
        inline: [/[\\/]agenticdevelopertoolkit[\\/]/],
      },
    },
  },
})
