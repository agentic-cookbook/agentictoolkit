import { featureVitest } from '../vitest.preset'

// `setupFiles` is not optional for this package, whatever the one-line configs elsewhere suggest.
// Every pane here (SetupPane, OffersPane, PayersPane, EventsPane) reads through `useResourceList`,
// whose QueryClient is at MODULE scope with a five-minute `staleTime` — so without
// `data/vitest-setup.ts`'s `afterEach` clear, the second test in a file is served the FIRST test's
// rows and its own fetcher is never called. It fails as "my fixture never appeared", on a line
// that says nothing about caching.
export default featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })
