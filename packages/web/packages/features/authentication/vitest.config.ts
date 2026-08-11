import { featureVitest } from '../vitest.preset'

// The panes here read through `useResourceList`/`useResourceItem`, whose query client is MODULE
// scope and so outlives `cleanup()` — one cache for every test in a file. `data/vitest-setup`
// empties it between tests.
export default featureVitest({ passWithNoTests: true, setupFiles: ['../../data/vitest-setup.ts'] })
