import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // Entry is GLOBBED, not hand-listed, so a new hook/component auto-builds an
  // entry without anyone editing this file — the tsup-entry gap (a src file that
  // the `exports` map's prod `import` condition points at, missing from dist
  // because dev resolves the `development` condition → src) becomes structurally
  // impossible. Mirror @agenticdevelopertoolkit/ui. esbuild's outbase is the common ancestor
  // `src/` (guaranteed by `src/index.ts`), so each file emits at the same dist
  // path a hand-list would produce. Keep in sync with package.json `exports`;
  // verify-shared-dist-exports.py gates the link. The extensions here are exactly the
  // ones the `exports` map's `development` condition names — `./hooks/*` → .ts,
  // `./components/*` → .tsx — because an exports map has no extension fallback: a
  // globbed-in `src/hooks/*.tsx` would build to dist and resolve in production while
  // `next dev` (which takes the `development` condition) failed to resolve it at all.
  // A hook that needs JSX means adding a line here AND a `./hooks-ui/*` export, not
  // widening this glob alone.
  entry: [
    'src/index.ts',
    'src/hooks/*.ts',
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
  // Peer/shared libs stay external so dist imports them (single version, resolved from the
  // consumer) rather than bundling copies — react, the sibling toolkit packages, lucide-react.
  external: [/^react/, /^@agentic-toolkit\//, 'lucide-react'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
