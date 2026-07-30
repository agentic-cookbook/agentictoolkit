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
  ;(globalThis as unknown as { window: unknown }).window = {
    fetch: originalFetch,
    location: { href: 'https://hub.dev.local/', host: 'hub.dev.local' },
  }
  instrumentFetch()
})

beforeEach(() => captureEventMock.mockClear())

const wfetch = (input: unknown, init?: unknown): Promise<Response> =>
  (globalThis as unknown as { window: { fetch: typeof fetch } }).window.fetch(
    input as RequestInfo,
    init as RequestInit,
  )

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
