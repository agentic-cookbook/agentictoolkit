import { featureTsup } from '../tsup.preset'

// `react-plaid-link` (PlaidLinkLauncher's script loader) needs no entry in the preset's
// `external` list: that list opens with /^react/, which is unanchored at the tail and
// therefore already matches it. Worth saying out loud, because the alternative — bundling a
// copy of Plaid's loader into this dist — would leave the site with two of them and no error.
//
// `IntegrationsOAuthCallback` is its own entry (the ./oauth-callback subpath) for the
// opposite reason to `parse-path`: not to escape the barrel's 'use client', which it wants,
// but to escape the barrel's SIZE. The route that mounts it renders a spinner and one fetch,
// and every site that starts a connect has to mount it — from the barrel that route was
// pulling the panes, the dialogs and the tables too, for nothing.
export default featureTsup([
  'src/index.ts',
  'src/parse-path.ts',
  'src/IntegrationsOAuthCallback.tsx',
])
