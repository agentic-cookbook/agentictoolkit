import { defineConfig } from 'vitest/config'

// Node environment: all code under test is pure async (markdown pipeline,
// fetch wrapper, registry lookups). No DOM / React rendering needed.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    dir: 'src',
    // shiki's createHighlighter loads theme/lang grammars on first call —
    // allow up to 30 s so slow CI doesn't flake on init.
    testTimeout: 30_000,
  },
})
