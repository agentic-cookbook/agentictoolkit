import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // adh-ui's exports map is hand-listed (no `./blocks/*` or `./components/*`
  // wildcards — every block lives behind one `./blocks` barrel and the only
  // component subpath is `./components/rdid-editor`), so the entry list is
  // hand-listed too: these seven are exactly this package's public surface.
  entry: [
    'src/index.ts',
    'src/lib/rdid.ts',
    'src/lib/invitations-endpoints.ts',
    'src/lib/invitations-types.ts',
    'src/lib/help-ids.ts',
    'src/blocks/index.ts',
    'src/components/rdid-editor.tsx',
  ],
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
  // Peer UI libs stay external so the dist imports them (single version,
  // resolved from the consumer) rather than bundling copies into each entry.
  // adh-ui has no dnd-kit- or harper.js-based UI, and does not import @base-ui/react
  // directly (see the entry-list comment above) — those hazard-specific `external`
  // entries belong to `ui`, this package's own dependency, not to this package.
  external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
