import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

// Seven entries so the built output lands at the exact paths package.json's `exports` map
// promises (`dist/profile.js`, `dist/types.js`, `dist/autofill.js`, `dist/client.js`,
// `dist/editors/index.js`, `dist/contact/index.js`, `dist/viewer/index.js`). `profile.ts` and `types.ts` are
// re-export-only and carry no directive, but `editors/index.ts`, `contact/index.ts` and
// `viewer/index.ts` all re-export 'use client' components — bitbag's config is the template
// (see its comment) rather than the shared `featureTsup` preset, because that preset's
// external list does not cover `@agenticdevelopertoolkit/*`.
//
// `viewer` is separate from `profile` for the reason its barrel states: one entry importing
// another's client chunk would put `'use client'` on both, and `profile` is the one that has
// to stay server-renderable.
export default defineConfig({
  entry: {
    profile: 'src/profile.ts',
    types: 'src/types.ts',
    // Plain string constants, no directive and no React — see src/autofill.ts.
    autofill: 'src/autofill.ts',
    client: 'src/client.ts',
    'editors/index': 'src/editors/index.ts',
    'contact/index': 'src/contact/index.ts',
    'viewer/index': 'src/viewer/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  // No splitting: splitting + preserve-directives is the exact combo that can strip the
  // `'use client'` banner off a hoisted shared chunk (bitbag's tsup.config.ts comment).
  splitting: false,
  outExtension: () => ({ js: '.js' }),
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@agenticdevelopertoolkit/registry-profile',
    '@agenticdevelopertoolkit/registry-types',
  ],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
