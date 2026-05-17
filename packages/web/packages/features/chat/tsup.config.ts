import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'modes/InlineChat': 'src/modes/InlineChat.tsx',
    'modes/ThreePaneChat': 'src/modes/ThreePaneChat.tsx',
    'modes/MobileChat': 'src/modes/MobileChat.tsx',
    'modes/PersonaChat': 'src/modes/PersonaChat.tsx',
    'components/Transcript': 'src/components/Transcript.tsx',
    'components/MessageBubble': 'src/components/MessageBubble.tsx',
    'components/ChatInput': 'src/components/ChatInput.tsx',
    'components/RichContent': 'src/components/RichContent.tsx',
    'components/InlinePopover': 'src/components/InlinePopover.tsx',
    'components/ContentOverlay': 'src/components/ContentOverlay.tsx',
    'components/SendIcon': 'src/components/SendIcon.tsx',
    'components/TypingIndicator': 'src/components/TypingIndicator.tsx',
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
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
