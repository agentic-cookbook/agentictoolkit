import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { adtAlias, adtInline } from '../../vitest.adt'

// Self-contained config so `pnpm --filter @agentic-toolkit/adh-ui run test`
// (cwd = this package) discovers src/__tests__/*. The workspace-root config's
// `dir: '../packages'` resolves outside the web workspace, so it finds nothing.
// We reuse the root setup file for its deterministic jest-dom/localStorage/
// ResizeObserver/matchMedia shims (see packages/web/vitest.setup.ts, and the
// @agenticdevelopertoolkit/ui package for the same pattern), plus a package-local
// setup for the @base-ui/react Dialog getComputedStyle patch this package's
// dialog-based blocks (SendInvitationModal, AdminNotesModal,
// TransferOwnershipSection, ...) need.
export default defineConfig({
  resolve: {
    // This package renders @agenticdevelopertoolkit/ui source, which lives in a
    // separate, uninstalled pnpm workspace. See ../../vitest.adt.ts for why that
    // needs the consumer to supply the tree, and why installing that workspace
    // would look like a fix and be worse.
    alias: adtAlias(fileURLToPath(new URL('.', import.meta.url))),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../../vitest.setup.ts', './vitest.setup.ts'],
    dir: 'src',
    server: {
      // Aliases only apply to modules vite processes. Deps resolved out of
      // another workspace are externalized by default and Node-resolve on their
      // own, so the alias never sees them.
      deps: { inline: adtInline },
    },
  },
})
