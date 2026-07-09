import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  // parse-path is its OWN entry (see the sibling features): directive-free, callable
  // from RSC hosts.
  entry: ['src/index.ts', 'src/parse-path.ts'],
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
