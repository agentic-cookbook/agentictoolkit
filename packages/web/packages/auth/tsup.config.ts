import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    'ui/index': 'src/ui/index.ts',
    'server/index': 'src/server/index.ts',
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
  // Code-split so modules shared across entries (notably `context.tsx`, which
  // creates the AuthContext, and `refresh.ts`/`config.ts`, whose module state —
  // the single-flight refresh promise, the generation counter, the runtime
  // config — must exist exactly ONCE) collapse into shared chunks that every
  // entry imports. Without splitting, `index` and `client` each bundle their
  // own copy: a useAuth() under /ui can't see the AuthProvider's context, and
  // invalidateRefresh() from the provider can't cancel a refresh started via
  // the client entry.
  splitting: true,
  outExtension: () => ({ js: '.js' }),
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/navigation',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
