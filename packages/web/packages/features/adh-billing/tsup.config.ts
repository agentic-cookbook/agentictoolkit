import { featureTsup } from '../tsup.preset'

// Two entries. The barrel is `use client` end to end (every export is a pane), and tsup hoists
// that directive over the chunk — so the URL grammar gets its own directive-free entry. Its
// consumer is a host's ROUTE, which parses (and 404s) before any pane exists.
export default featureTsup(['src/index.ts', 'src/parse-path.ts'])
