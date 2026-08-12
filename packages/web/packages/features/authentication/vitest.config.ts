import { featureVitest } from '../vitest.preset'

// The panes here read through `useResourceList`/`useResourceItem`, whose query client is MODULE
// scope and so outlives `cleanup()` — one cache for every test in a file. `data/vitest-setup`
// empties it between tests.
//
// `passWithNoTests` is deliberately absent: this package ships unit tests now, so an empty run
// means the suite stopped being discovered, which must fail rather than read as "nothing to check".
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
