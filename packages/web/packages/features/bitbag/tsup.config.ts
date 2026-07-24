import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// Single build: every entry here is a client component, so there is no
// server/client chunk graph to contaminate.
export default defineConfig({
  entry: { index: 'src/index.ts' },
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
  // bitbag opts OUT of the shared `featureTsup` preset (../tsup.preset.ts): its
  // external list only covers react, @agentic-toolkit/*, next/*, and lucide-react,
  // but bitbag also needs gsap and @agentic-developer-toolkit/* kept external.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'gsap',
    '@agentic-developer-toolkit/chat',
    '@agentic-developer-toolkit/avatar',
    '@agentic-developer-toolkit/themes',
    '@agentic-developer-toolkit/viewport',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
