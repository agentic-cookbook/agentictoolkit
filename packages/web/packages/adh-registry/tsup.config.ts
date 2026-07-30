import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'seo/index': 'src/seo/index.ts',
    'sites/routes.generated': 'src/sites/routes.generated.ts',
  },
  format: ['esm'],
  target: 'es2022',
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
})
