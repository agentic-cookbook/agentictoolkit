import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    colorMode: 'src/colorMode.tsx',
    appearance: 'src/appearance.ts',
    'appearance-store': 'src/appearance-store.tsx',
    ThemeStyle: 'src/ThemeStyle.tsx',
    manifest: 'src/manifest.ts',
    tokens: 'src/tokens.ts',
    fonts: 'src/fonts.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  // Everything in dist EXCEPT the CSS. `build:css` writes dist/**/*.css a build step AFTER
  // tsup, so a plain `clean: true` leaves a window in which dist holds the JS and none of the
  // styles — and anything resolving this package's `./css/*` exports during it (a running dev
  // server, a site building in parallel) gets "no valid target file was found" and caches the
  // failure. Negating them costs nothing in staleness: copy-css.mjs prunes the orphans.
  clean: ['!**/*.css'],
  dts: false,
  bundle: true,
  splitting: true,
  outExtension: () => ({ js: '.js' }),
  external: ['react', 'react-dom', 'react/jsx-runtime', '@agentic-toolkit/ui'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
