import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // Globbed entries mirror the exports map so a new module auto-builds without
  // editing this file — same pattern as @adh-shared/ui and @adh-shared/markdown.
  entry: [
    'src/index.ts',
    'src/data/*.ts',
    'src/data/*.tsx',
    'src/registry/*.ts',
    'src/registry/*.tsx',
    'src/components/*.tsx',
    'src/components/**/*.tsx',
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
    '@agentic-toolkit/markdown',
    '@agentic-toolkit/markdown/*',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
