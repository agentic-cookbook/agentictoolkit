import { featureTsup } from '../tsup.preset'

// Two entries. The barrel is `use client` end to end (every export is a pane), and tsup
// hoists that directive over the chunk — so the bucket type catalogue, which is plain data
// and pure functions, gets the second entry the preset describes for exactly this case.
// Its consumers are why: a Playwright spec and a drift guard read it OUTSIDE React.
export default featureTsup(['src/index.ts', 'src/schemas/available-types.ts'])
