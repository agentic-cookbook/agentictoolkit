import { defineConfig } from 'vitest/config'

// `dir: 'src'` keeps the run to src/__tests__ — the two spec-drift gates. They read
// adh's openapi.json, which is NOT in this repo: it arrives via ADH_OPENAPI_SPEC and
// the gates skip (loudly) when it is unset. See src/__tests__/adh-spec.ts.
export default defineConfig({
  test: {
    environment: 'node',
    dir: 'src',
  },
})
