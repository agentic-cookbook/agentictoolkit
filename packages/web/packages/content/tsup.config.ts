import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/EntryCard': 'src/components/EntryCard.tsx',
    'components/SectionCard': 'src/components/SectionCard.tsx',
    'components/MarkdownView': 'src/components/MarkdownView.tsx',
    'components/HomePage': 'src/components/HomePage.tsx',
    'components/HomePageConnected': 'src/components/HomePageConnected.tsx',
    'components/SectionIndex': 'src/components/SectionIndex.tsx',
    'components/SectionIndexConnected': 'src/components/SectionIndexConnected.tsx',
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
  external: ['react', 'react-dom', 'react/jsx-runtime', '@agentic-toolkit/model'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
