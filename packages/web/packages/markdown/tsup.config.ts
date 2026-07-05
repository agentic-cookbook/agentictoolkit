import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // Globbed entries mirror the exports map so a new module auto-builds
  // without editing this file — same pattern as @adh-shared/ui.
  entry: [
    'src/index.ts',
    'src/hooks/*.ts',
    'src/hooks/*.tsx',
    'src/themes/*.ts',
    'src/lib/*.ts',
    'src/components/*.tsx',
  ],
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
  // External peers — resolved from the consumer, not bundled.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@agentic-toolkit/ui',
    '@agentic-toolkit/ui/*',
    // Heavy markdown/highlight deps stay external so the consumer's bundler
    // can tree-shake and deduplicate them.
    'shiki',
    '@shikijs/rehype',
    '@shikijs/rehype/core',
    'unified',
    'gray-matter',
    'remark-parse',
    'remark-gfm',
    'remark-rehype',
    'rehype-slug',
    'rehype-autolink-headings',
    'rehype-sanitize',
    'rehype-stringify',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
