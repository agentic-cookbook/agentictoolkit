import { defineConfig } from 'vitest/config'

const VIRTUAL_ID = 'virtual:reference-site-content'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export default defineConfig({
  plugins: [
    {
      name: 'stub-reference-site-content',
      resolveId(id: string) {
        if (id === VIRTUAL_ID) return RESOLVED_ID
      },
      load(id: string) {
        if (id === RESOLVED_ID) return 'export default []'
      },
    },
  ],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    dir: '../packages',
  },
})
