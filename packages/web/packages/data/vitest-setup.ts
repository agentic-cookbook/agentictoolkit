import { afterEach } from 'vitest'
import { getToolkitQueryClient } from './src/query'

/**
 * Empty the toolkit's query cache between tests.
 *
 * The QueryClient is at MODULE scope — one per browser tab, deliberately, so that a topic click
 * cannot destroy it. In a test process that means ONE cache for every test in a file, and it
 * outlives `cleanup()`: the DOM teardown knows nothing about it. Leave it standing and a list or
 * an item a previous test loaded is still cached and still fresh, so the next test's fetcher is
 * never called and its rows are the PREVIOUS test's rows. That fails as "my fixture never
 * appeared" — a message describing the cache working exactly as designed, on a line that has
 * nothing to do with caching.
 *
 * It lives here, in the package that owns the client, rather than in the workspace-root setup
 * file: that file sits above `packages/`, where no `@agentic-toolkit/*` resolves. A consuming
 * package adds it by path — `featureVitest({ setupFiles: ['../../data/vitest-setup.ts'] })` — and
 * gets the teardown for every test file it will ever have, instead of one copy per file that the
 * next test written is free to forget.
 */
afterEach(() => {
  getToolkitQueryClient().clear()
})
