import { defineConfig, type Options } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// Single source of the feature-package build knowledge (DRY). Every
// @agentic-toolkit/features/* package builds the same way — ESM, browser, code
// splitting, directives preserved, and react + the sibling toolkit packages +
// next + lucide-react kept external — differing ONLY in which entry points it
// exposes. A per-package tsup.config.ts is therefore one line: the default export
// of `featureTsup(entries)`.
//
// The `parse-path` / `tables` entries a caller lists are deliberately their OWN
// chunks: the barrel dist hoists 'use client' (whole-file client module), which
// would make those helpers uncallable from an RSC host page. A separate
// directive-free chunk keeps the URL grammar / table metadata server-safe (the
// ./parse, ./tables subpaths).
//
// `chat` opts OUT (its own tsup.config.ts): it has a bespoke multi-entry map and a
// narrower `external` set, so it does not share this knowledge.
export function featureTsup(entry: Options['entry']) {
  return defineConfig({
    entry,
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
    // Peer/shared libs stay external so dist imports them (single version, resolved
    // from the consumer) rather than bundling copies: react, the sibling toolkit
    // packages, next (the host app owns it), and lucide-react.
    external: [/^react/, /^@agentic-toolkit\//, /^next\//, 'lucide-react'],
    esbuildPlugins: [
      preserveDirectivesPlugin({
        directives: ['use client', 'use server'],
        include: /\.(js|ts|jsx|tsx)$/,
        exclude: /node_modules/,
      }),
    ],
  })
}
