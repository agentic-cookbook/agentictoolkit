import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Built (not just left to `development`→src) even though the main barrel
    // deliberately omits it — the monorepo's drift test imports this subpath
    // directly in prod-like CI runs, and the package.json `exports` map's
    // `import` condition points at dist.
    'generated/endpoints.generated': 'src/generated/endpoints.generated.ts',
  },
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
  external: [
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
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
