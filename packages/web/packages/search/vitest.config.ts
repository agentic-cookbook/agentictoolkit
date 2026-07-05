import { defineConfig } from 'vitest/config'

// Node environment: the only unit under test is the pure URL/query builder in the
// data layer (no DOM / React rendering needed).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    dir: 'src',
  },
})
