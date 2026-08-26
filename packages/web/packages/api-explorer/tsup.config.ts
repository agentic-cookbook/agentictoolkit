import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'next',
  'next/link',
  'next/navigation',
  'next/dynamic',
  '@agentic-toolkit/auth',
  '@agentic-toolkit/auth/client',
  '@agenticdevelopertoolkit/ui',
  '@agenticdevelopertoolkit/ui/*',
  'lucide-react',
  // Externalized so the consuming Next app bundles it (and code-splits the
  // dynamic import); keeps a heavy wasm/langs payload out of dist and lazy.
  'shiki',
  // lib/getEndpoint.ts and lib/highlight.ts both hold top-level mutable state
  // (`_tags`/`_byTag` lazy-cache Maps; `highlighterPromise`) and are imported by
  // BOTH the client barrel (ApiBrowser.tsx / index.ts) and the server entry
  // (ApiReferenceShell.tsx / server.ts). This package deliberately builds those
  // two as SEPARATE, non-shared chunk graphs (see the comment on the two-build
  // array below), so without this, each graph would inline its own private copy
  // of that state — same shape as @agentic-toolkit/adh's flags/telemetry/
  // DbThemeApplier preserved imports. Preserved import ⇒ one copy per resolving
  // bundler (the consumer's, for the client half; Node's module cache, for the
  // server half), never a silent per-entry fork.
  '@agentic-toolkit/api-explorer/lib/getEndpoint',
  '@agentic-toolkit/api-explorer/lib/highlight',
]

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
  external,
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
}

// TWO independent builds — the client barrel and the server entry must NOT share a chunk graph.
// esbuild-plugin-preserve-directives propagates a chunk's `'use client'` to every entry that imports
// it; when index.ts (the 'use client' barrel) and server.ts share the `getEndpoint`/metadata chunk,
// that chunk inherits `'use client'` and calling `allTags()` from the server reference throws
// "called from the server but is on the client". Separate builds = separate chunk graphs, so the
// server bundle stays entirely server-safe (it imports no 'use client' module at all).
export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      // Built (not just left to `development`→src) even though the main barrel
      // deliberately omits it — the monorepo's drift test imports this subpath
      // directly in prod-like CI runs, and the package.json `exports` map's
      // `import` condition points at dist.
      'generated/endpoints.generated': 'src/generated/endpoints.generated.ts',
      // Their own entries so the `external` preserved-import above resolves to a
      // real built file — see that comment for why these can't stay inlined.
      'lib/getEndpoint': 'src/lib/getEndpoint.ts',
      'lib/highlight': 'src/lib/highlight.ts',
    },
    clean: true,
  },
  {
    ...shared,
    // The server-only reference (ApiReferenceShell / ApiEndpointReference / StaticCodeBlock + slug
    // helpers). clean:false so it adds to — rather than wipes — the client build above.
    entry: { server: 'src/server.ts' },
    clean: false,
  },
])
