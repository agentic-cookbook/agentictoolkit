import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

const shared = {
  outDir: 'dist',
  format: ['esm'] as const,
  target: 'es2022' as const,
  platform: 'browser' as const,
  sourcemap: true,
  dts: false,
  bundle: true,
  splitting: true,
  outExtension: () => ({ js: '.js' }),
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
}

// TWO independent builds — the server-safe barrel and the client barrel must NOT
// share a chunk graph. esbuild-plugin-preserve-directives propagates a chunk's
// `'use client'` to every entry that imports it, so while NavChrome was exported
// from src/index.ts, the directive was hoisted onto dist/index.js itself and
// every export in the package became a Client Component. Separate builds =
// separate chunk graphs, so index.js stays free of the directive and only
// client.js carries it.
//
// This is the same trap, and the same fix, as packages/api-explorer — see the
// comment in its tsup.config.ts. Note that `splitting: false` does NOT solve it:
// with a single entry NavChrome's code is inlined into index.js either way, and
// the directive comes with it. The entry split is the mechanism, not the flag.
//
// tools/check-directives.py asserts the outcome, because nothing in tsc, ESLint
// or vitest can see it and a successful `next build` does not imply it.
export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    // Everything in dist EXCEPT the CSS. `build:css` writes dist/**/*.css a build step AFTER
  // tsup, so a plain `clean: true` leaves a window in which dist holds the JS and none of the
  // styles — and anything resolving this package's `./css/*` exports during it (a running dev
  // server, a site building in parallel) gets "no valid target file was found" and caches the
  // failure. Negating them costs nothing in staleness: copy-css.mjs prunes the orphans.
  clean: ['!**/*.css'],
  },
  {
    ...shared,
    // clean:false so it adds to — rather than wipes — the build above. tsup runs
    // the two concurrently, so in principle the clean above could land after this
    // one's write; api-explorer has shipped the same shape without seeing it, and
    // check-directives.py fails on a missing entry, so the race is loud, not silent.
    entry: { client: 'src/client.ts' },
    clean: false,
  },
])
