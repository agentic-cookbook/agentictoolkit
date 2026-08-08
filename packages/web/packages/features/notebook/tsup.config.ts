import { featureTsup } from '../tsup.preset'

// `src/parse-path.ts` is its own entry so the URL grammar stays a directive-free,
// server-safe chunk (the ./parse subpath) — the barrel's dist hoists 'use client'.
export default featureTsup(['src/index.ts', 'src/parse-path.ts'])
