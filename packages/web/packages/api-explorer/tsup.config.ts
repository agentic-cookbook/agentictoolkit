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
  '@agentic-toolkit/ui',
  '@agentic-toolkit/ui/*',
  'lucide-react',
  // Externalized so the consuming Next app bundles it (and code-splits the
  // dynamic import); keeps a heavy wasm/langs payload out of dist and lazy.
  'shiki',
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
