import { featureTsup } from '../tsup.preset'

// Four entries, and the split is about WHO IMPORTS WHAT, not about tidiness.
//
// The barrel is the five operator panes. It is `use client` end to end and tsup hoists that
// directive over the chunk, so `src/parse-path.ts` gets its own directive-free entry: its consumer
// is a host's ROUTE, which parses (and 404s) before any pane exists.
//
// The other two entries are client code, and they exist for the bundler rather than for the
// directive. A static import of ANY barrel export pulls the whole bundled module, so a host that
// reached `useBillingContext` or `claimPurchase` through the barrel would eagerly load all five
// panes — and, through the Stripe topic, `@agentic-toolkit/integrations`' pane — however carefully
// it wrapped `BillingGroup` in `next/dynamic`. That is not hypothetical: the hub's workspace shell
// and the products site both need the hook to decide what to render BEFORE the rail mounts, and
// `/claim` is a public page that needs no operator surface at all.
export default featureTsup([
  'src/index.ts',
  'src/parse-path.ts',
  'src/useBillingContext.ts',
  'src/claim.ts',
])
