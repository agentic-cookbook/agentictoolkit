import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/query/index.tsx',
    'src/projects/index.ts',
    'src/reactions/index.ts',
    'src/teams/index.ts',
    'src/ecosystems/index.ts',
    'src/monitored-sites/index.ts',
    'src/markdown/index.ts',
    'src/personas/index.ts',
    'src/security/index.ts',
    'src/integrations/index.ts',
    'src/gamification/index.ts',
    'src/invitations/index.ts',
    'src/access/index.ts',
    'src/ownership/index.ts',
    'src/stream/index.ts',
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
  external: [/^react/, /^@agentic-toolkit\//],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
