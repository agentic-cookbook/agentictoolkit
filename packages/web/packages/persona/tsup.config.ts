import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// Four entries, one per persona package this bridges. Keeping them separate
// (rather than one barrel) means a consumer that only wants viewport primitives
// does not pull chat, themes and the avatar engine into its graph.
export default defineConfig({
  entry: {
    avatar: 'src/avatar.ts',
    chat: 'src/chat.ts',
    themes: 'src/themes.ts',
    viewport: 'src/viewport.ts',
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
  splitting: false,
  outExtension: () => ({ js: '.js' }),
  // THE point of this package: every `@agenticdevelopertoolkit/*` specifier must
  // survive into `dist` as a bare specifier. Bundling one in would defeat the
  // whole exercise — the copy would be inlined here AND resolved separately by
  // any consumer that also reaches it through bitbag, which is exactly the
  // two-copies bug this package exists to remove.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'gsap',
    '@agenticdevelopertoolkit/avatar',
    '@agenticdevelopertoolkit/chat',
    '@agenticdevelopertoolkit/themes',
    '@agenticdevelopertoolkit/viewport',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
