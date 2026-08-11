import { featureVitest } from '../vitest.preset'

// The query-cache reset: this package's panes now read through the toolkit's MODULE-SCOPE query
// client, which outlives `cleanup()` — without this one test's rows paint in the next one.
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
