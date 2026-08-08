import { featureTsup } from '../tsup.preset'

// `dialog-state` is a SECOND entry, not just a second file: the barrel's chunk carries
// `use client`, and esbuild-plugin-preserve-directives propagates that to every entry that
// imports it. These gates are pure logic with no React, and the admin site imports them into
// pages that must stay server-safe — so they need an entry of their own to keep the directive off.
export default featureTsup(['src/index.ts', 'src/dialog-state/index.ts'])
