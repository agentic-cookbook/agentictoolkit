import { featureTsup } from '../tsup.preset'

// Three entries, matching package.json's `exports`. `types` and `client` are their own
// chunks on purpose: the barrel hoists `'use client'` (it re-exports client components),
// and a server component that only needs the wire types would inherit that directive if
// they came off it.
export default featureTsup(['src/index.ts', 'src/types.ts', 'src/client.ts'])
