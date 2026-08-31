import { featureTsup } from '../tsup.preset'

// Two entries, for the reason the preset describes. The barrel is `use client` — the feature is
// an explorer over client panes — and tsup hoists that directive over the whole chunk, so the
// URL GRAMMAR gets an entry of its own. Its consumer is a Server Component page that wants to
// know what a path selects before it renders anything.
export default featureTsup(['src/index.ts', 'src/paths.ts'])
