import { featureVitest } from '../vitest.preset'

// The data package's teardown, because this feature reads through `useResourceList` — the
// registries list, an entry's services, its providers, the pending queue. That client is at
// MODULE scope, so without this every test in a file inherits the previous test's rows and
// fetchers stop being called; see ../../data/vitest-setup.ts for the whole reason. Its absence
// cost a run here on 2026-08-31: fifteen EntryServicesPanel tests failed on "Unable to find an
// element with the text: No services yet.", with a leftover Service 1 row on screen.
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
