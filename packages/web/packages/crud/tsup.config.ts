import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // The generated catalog is its OWN entry: the barrel dist hoists 'use client'
    // (whole-file client module), which would make CRUD_TABLES an un-dereferenceable
    // client reference in an RSC page. This chunk is plain data, directive-free
    // (./generated/table-metadata) — mirrors api-explorer's generated subpath.
    'generated/table-metadata': 'src/generated/table-metadata.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  outExtension: () => ({ js: '.js' }),
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/link',
    'next/navigation',
    '@agentic-toolkit/auth',
    '@agentic-toolkit/auth/client',
    '@agentic-toolkit/api-explorer',
    '@agentic-toolkit/ui',
    '@agentic-toolkit/ui/*',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
