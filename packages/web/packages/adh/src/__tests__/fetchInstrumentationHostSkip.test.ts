// @vitest-environment-options { "url": "https://hub.dev.local/" }
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Separate file (fresh module registry) so instrumentFetch installs against a RELATIVE
// posthog api_host — the reverse-proxy case that a naive `new URL(host)` would drop.
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))

const captureEventMock = vi.hoisted(() => vi.fn())
vi.mock('../telemetry/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../telemetry/analytics')>()
  return { ...actual, captureEvent: captureEventMock }
})

import { instrumentFetch } from '../telemetry/fetch-instrumentation'

let originalFetch: ReturnType<typeof vi.fn>

beforeAll(() => {
  process.env.NEXT_PUBLIC_POSTHOG_HOST = '/ingest' // same-origin reverse proxy
  originalFetch = vi.fn(async () => new Response('{}', { status: 200 }))
  // jsdom's own window, with only `fetch` swapped: a hand-built stand-in stopped working the
// moment a shared setup file reached for something else on it (`../data/vitest-setup.ts` clears
// the toolkit query cache, and the client's session watcher reads `window.localStorage`). The
// origin comes from the environment options above, so `location.href` and `location.host` are
// jsdom's and stay consistent with each other.
  window.fetch = originalFetch as unknown as typeof fetch
  instrumentFetch()
})

beforeEach(() => captureEventMock.mockClear())

const wfetch = (input: unknown, init?: unknown): Promise<Response> =>
  window.fetch(input as RequestInfo, init as RequestInit)

describe('telemetry host skip (relative reverse-proxy api_host)', () => {
  it('skips same-origin PostHog beacons but still captures real requests', async () => {
    await wfetch('/ingest/e/', { method: 'POST' })
    expect(captureEventMock).not.toHaveBeenCalled()

    await wfetch('/api/auth/me')
    expect(captureEventMock).toHaveBeenCalledTimes(1)
  })

  it('does not skip a real route that merely shares the proxy prefix', async () => {
    // `/ingest-data` is NOT under `/ingest/` — must be captured, not swallowed.
    await wfetch('/ingest-data/status')
    expect(captureEventMock).toHaveBeenCalledTimes(1)
  })
})
