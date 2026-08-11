import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// TWO named entries, matching the two keys in package.json `exports` — and no glob,
// ever. The bound controls have no entry, so no import specifier reaches them, and
// that unreachability IS this package's compile-time enforcement.
// `frontend/tools/check_editing_boundary.py` (in adh) asserts the entries, the
// exports keys and the barrel against each other on every CI run.
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
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    /^@agentic-toolkit\//,
    '@base-ui/react',
    '@base-ui/react/*',
    'lucide-react',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
}

// The two builds must NOT share a chunk graph. `esbuild-plugin-preserve-directives`
// propagates a chunk's `'use client'` to every entry importing it, and the main
// barrel IS the client one (the container and the host both carry the directive).
// Sharing the descriptors/sections chunk would hoist `'use client'` onto the server
// entry, whose entire reason to exist is that it does not have it — and nothing
// would report the loss: a Client Component is legal, so tsc, vitest and
// `next build` all stay green while a Server Component that imports `section()`
// starts throwing at runtime.
export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
  },
  {
    // The declarative half — descriptors and sections, no React. clean:false so it
    // adds to the client build above rather than wiping it.
    ...shared,
    entry: { server: 'src/server.ts' },
    clean: false,
  },
])
