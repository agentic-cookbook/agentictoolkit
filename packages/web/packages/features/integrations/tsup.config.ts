import { featureTsup } from '../tsup.preset'

// `react-plaid-link` (PlaidLinkLauncher's script loader) needs no entry in the preset's
// `external` list: that list opens with /^react/, which is unanchored at the tail and
// therefore already matches it. Worth saying out loud, because the alternative — bundling a
// copy of Plaid's loader into this dist — would leave the site with two of them and no error.
export default featureTsup(['src/index.ts', 'src/parse-path.ts'])
