import { featureTsup } from '../tsup.preset'

// Three entries. The barrel is `use client` end to end (every export is a pane), and tsup
// hoists that directive over the chunk — so the two things here that are NOT panes get the
// extra entries the preset describes for exactly this case. Their consumers are why: the
// bucket type catalogue is read OUTSIDE React (a Playwright spec and a drift guard), and the
// storage URL grammar is called by a host's Server Component route, before any pane exists.
export default featureTsup([
  'src/index.ts',
  'src/schemas/available-types.ts',
  'src/storage/parse-path.ts',
])
