import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // Entry is GLOBBED, not hand-listed, so a new component/block auto-builds an
  // entry without anyone editing this file — the tsup-entry gap (a src file that
  // the `exports` map's prod `import` condition points at, missing from dist
  // because dev resolves the `development` condition → src) becomes structurally
  // impossible. The set mirrors @agentic-toolkit/ui's `exports`, which is itself glob
  // based (`./components/*`, `./blocks/*`). esbuild's outbase is the common
  // ancestor `src/` (guaranteed by `src/index.ts`), so each file emits at the
  // same dist path the old hand-list produced (verified byte-identical). Keep in
  // sync with package.json `exports`; verify-shared-dist-exports.py gates the link.
  entry: [
    'src/index.ts',
    'src/lib/*.ts',
    'src/hooks/*.ts',
    'src/hooks/*.tsx',
    'src/components/*.tsx',
    'src/blocks/index.ts',
    'src/blocks/*.tsx',
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
  // Peer UI libs stay external so the dist imports them (single version,
  // resolved from the consumer) rather than bundling copies into each entry.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@base-ui/react',
    '@base-ui/react/*',
    'lucide-react',
    // dnd-kit keeps module-scope state (the sensor/collision registries live in
    // React context created at import time), so two bundled copies would put a
    // DndContext and its useSortable in different registries and every drag
    // would silently find no droppables. External = one copy, resolved by the
    // consumer, same as @base-ui/react.
    '@dnd-kit/core',
    '@dnd-kit/sortable',
    '@dnd-kit/utilities',
    // harper.js (markdown-spellcheck) is dynamically imported and ships a multi-MB
    // WASM worker. Keep it external so dist re-emits the `import('harper.js')`
    // verbatim and the CONSUMER's bundler (Next) code-splits + lazy-loads it,
    // instead of tsup trying to inline the WASM into this package's chunks.
    'harper.js',
    'harper.js/binaryInlined',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
