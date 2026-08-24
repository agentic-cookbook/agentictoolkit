import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // Globbed entries mirror the exports map so a new module auto-builds without
  // editing this file — same pattern as @agentic-toolkit/ui and @agentic-toolkit/markdown.
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
  // Everything in dist EXCEPT the CSS. `build:css` runs tailwind into dist/styles.css a build
  // step AFTER tsup, so a plain `clean: true` leaves a window in which dist holds the JS and no
  // stylesheet — and anything resolving this package's CSS export during it (a running dev
  // server, a site building in parallel) gets "no valid target file was found" and caches the
  // failure. Nothing goes stale: tailwind overwrites the one file it owns.
  clean: ['!**/*.css'],
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
