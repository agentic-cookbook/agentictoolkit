import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// Three entries, one per persona package this bridges. Keeping them separate
// (rather than one barrel) means a consumer that only wants viewport primitives
// does not pull chat and themes into its graph.
export default defineConfig({
  entry: {
    chat: 'src/chat.ts',
    themes: 'src/themes.ts',
    viewport: 'src/viewport.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  splitting: false,
  outExtension: () => ({ js: '.js' }),
  // THE point of this package: every `@agenticdevelopertoolkit/*` specifier must
  // survive into `dist` as a bare specifier. Bundling one in would defeat the
  // whole exercise — the copy would be inlined here AND resolved separately by
  // any consumer that also reaches it through bitbag, which is exactly the
  // two-copies bug this package exists to remove.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@agenticdevelopertoolkit/chat',
    '@agenticdevelopertoolkit/themes',
    '@agenticdevelopertoolkit/viewport',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
