import { featureVitest } from '../vitest.preset'

// The org record is read through `useResourceItem`, whose query client is MODULE scope and so
// outlives `cleanup()` — one cache for every test in a file. `data/vitest-setup` empties it between
// tests, so a test's mocked `resolve` is called rather than the previous test's org being served
// from cache.
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
