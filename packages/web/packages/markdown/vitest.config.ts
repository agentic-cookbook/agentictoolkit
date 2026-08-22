import { defineConfig } from 'vitest/config'

// Node environment by default: the pipeline/fetcher/registry tests are pure async with no
// DOM. The package ships several React components — but this file's only DOM test is
// MarkdownDocumentEditor's, which opts itself into jsdom with a `// @vitest-environment jsdom`
// docblock rather than making every test pay for a DOM.
//
// The root setup file supplies the jest-dom matchers plus the jsdom shims (matchMedia,
// ResizeObserver, storage). Every shim in it is guarded on `typeof window !== 'undefined'`,
// so it is inert in the node-environment files and safe to apply globally.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['../../vitest.setup.ts'],
    dir: 'src',
    // shiki's createHighlighter loads theme/lang grammars on first call —
    // allow up to 30 s so slow CI doesn't flake on init.
    testTimeout: 30_000,
  },
})
