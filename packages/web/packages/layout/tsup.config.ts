import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'components/AppShell': 'src/components/AppShell.tsx',
    'components/Breadcrumbs': 'src/components/Breadcrumbs.tsx',
    'components/BreadcrumbsConnected': 'src/components/BreadcrumbsConnected.tsx',
    'components/Header': 'src/components/Header.tsx',
    'components/HeaderConnected': 'src/components/HeaderConnected.tsx',
    'components/Sidebar': 'src/components/Sidebar.tsx',
    'components/SidebarConnected': 'src/components/SidebarConnected.tsx',
    'components/TableOfContents': 'src/components/TableOfContents.tsx',
    'components/TableOfContentsConnected': 'src/components/TableOfContentsConnected.tsx',
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
  external: ['react', 'react-dom', 'react/jsx-runtime', '@agentic-web-toolkit/model'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
