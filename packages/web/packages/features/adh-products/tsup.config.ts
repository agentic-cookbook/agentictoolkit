import { featureTsup } from '../tsup.preset'

// Two entries. The barrel is `use client` (the feature and its topic-pane switch), and tsup
// hoists that directive over the chunk — so the topic RAIL, which is plain data, gets the
// second entry the preset describes for exactly this case: a Server Component route that only
// wants to know a product topic's id or label should not pull the whole feature onto the client.
export default featureTsup(['src/index.ts', 'src/topics.ts'])
