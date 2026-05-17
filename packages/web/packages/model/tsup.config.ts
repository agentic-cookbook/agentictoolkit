import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
    'providers/SiteConfigProvider': 'src/providers/SiteConfigProvider.tsx',
    'providers/ContentProvider': 'src/providers/ContentProvider.tsx',
    'providers/LinkProvider': 'src/providers/LinkProvider.tsx',
    'providers/RouteProvider': 'src/providers/RouteProvider.tsx',
    'hooks/useSearchState': 'src/hooks/useSearchState.ts',
    'lib/nav': 'src/lib/nav.ts',
    'lib/breadcrumbs': 'src/lib/breadcrumbs.ts',
    'lib/lookup': 'src/lib/lookup.ts',
    'lib/search': 'src/lib/search.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  splitting: true,
  outExtension: () => ({ js: '.js' }),
  external: ['react', 'react-dom', 'react/jsx-runtime', 'fuse.js'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
