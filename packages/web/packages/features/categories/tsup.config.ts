import { featureTsup } from '../tsup.preset'

// `src/chain.ts` is its own entry so the rail's reserved URL TOKENS stay a directive-free,
// server-safe chunk (the ./chain subpath) — the barrel's dist hoists 'use client', which turns
// a constant imported into an RSC from a string into an opaque client reference. See
// `src/chain.ts` and `tools/check-directives.py`.
export default featureTsup(['src/index.ts', 'src/chain.ts'])
