import { featureVitest } from '../vitest.preset'

// EcosystemsFeature reads through `useResourceList`, whose query client is MODULE scope and so
// outlives `cleanup()` — one cache for every test in a file. `data/vitest-setup` empties it
// between tests, so a test's mocked list is read rather than the previous test's answer.
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
