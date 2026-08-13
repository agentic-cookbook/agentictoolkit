// @vitest-environment-options { "url": "https://hub.dev.local/" }
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Mock posthog-js (the real module is browser-oriented) and spy on captureEvent while
// keeping the real scrubPath / consumeRetriedFlag / markRetriedRequest.
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))

const captureEventMock = vi.hoisted(() => vi.fn())
vi.mock('../telemetry/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../telemetry/analytics')>()
  return { ...actual, captureEvent: captureEventMock }
})

import { instrumentFetch } from '../telemetry/fetch-instrumentation'
import { markRetriedRequest } from '../telemetry/analytics'

let originalFetch: ReturnType<typeof vi.fn>

function lastProps(): Record<string, unknown> {
  const calls = captureEventMock.mock.calls
  return calls[calls.length - 1]?.[1] as Record<string, unknown>
}

const wfetch = (input: unknown, init?: unknown): Promise<Response> =>
  window.fetch(input as RequestInfo, init as RequestInit)

beforeAll(() => {
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://ph.example.com'
  originalFetch = vi.fn(
    async () =>
      new Response('{}', {
        status: 200,
        headers: { 'Server-Timing': 'app;dur=12.5, db;dur=4;desc="2"' },
      }),
  )
  // jsdom's own window, with only `fetch` swapped: a hand-built stand-in stopped working the
// moment a shared setup file reached for something else on it (`../data/vitest-setup.ts` clears
// the toolkit query cache, and the client's session watcher reads `window.localStorage`). The
// origin comes from the environment options above, so `location.href` and `location.host` are
// jsdom's and stay consistent with each other.
  window.fetch = originalFetch as unknown as typeof fetch
  instrumentFetch()
})

beforeEach(() => {
  captureEventMock.mockClear()
  originalFetch.mockClear()
})

describe('instrumentFetch', () => {
  it('emits http_request with scrubbed path + parsed Server-Timing', async () => {
    await wfetch('/api/persona/services/3f8b1c2d-1234-4abc-89de-0123456789ab', { method: 'GET' })
    expect(captureEventMock).toHaveBeenCalledTimes(1)
    const [name, props] = captureEventMock.mock.calls[0]!
    expect(name).toBe('http_request')
    expect(props.path).toBe('/api/persona/services/:id')
    expect(props.method).toBe('GET')
    expect(props.status).toBe(200)
    expect(props.ok).toBe(true)
    expect(props.server_ms).toBe(12.5)
    expect(props.db_ms).toBe(4)
    expect(props.db_count).toBe(2)
    expect(props.authenticated).toBe(false)
    expect(typeof props.cold).toBe('boolean')
    expect(typeof props.duration_ms).toBe('number')
  })

  it('drops malformed Server-Timing dur values instead of emitting NaN', async () => {
    originalFetch.mockResolvedValueOnce(
      new Response('{}', { status: 200, headers: { 'Server-Timing': 'app;dur=., db;dur=1.2.3;desc="x"' } }),
    )
    await wfetch('/api/m')
    const p = lastProps()
    expect('server_ms' in p).toBe(false)
    expect('db_ms' in p).toBe(false)
    expect('db_count' in p).toBe(false) // desc="x" → Number('x')=NaN → omitted
  })

  it('flags authenticated when an Authorization header is present', async () => {
    await wfetch('/api/auth/me', { headers: { Authorization: 'Bearer abc' } })
    expect(lastProps().authenticated).toBe(true)
  })

  it('tags the post-refresh retry via the marker on the same init object', async () => {
    const init = { method: 'GET' }
    markRetriedRequest(init)
    await wfetch('/api/x', init)
    expect(lastProps().retried).toBe(true)
  })

  it('tags a retry marked on a Request input passed with no init', async () => {
    const req = new Request('https://hub.dev.local/api/z', { method: 'GET' })
    markRetriedRequest(req)
    await wfetch(req)
    expect(lastProps().retried).toBe(true)
  })

  it('skips telemetry-ingestion hosts (no recursive capture)', async () => {
    await wfetch('https://ph.example.com/e/', { method: 'POST' })
    expect(captureEventMock).not.toHaveBeenCalled()
    expect(originalFetch).toHaveBeenCalledTimes(1)
  })

  it('records a failure and re-throws when the underlying fetch rejects', async () => {
    originalFetch.mockRejectedValueOnce(new Error('net down'))
    await expect(wfetch('/api/y', {})).rejects.toThrow('net down')
    expect(captureEventMock).toHaveBeenCalledTimes(1)
    expect(lastProps().status).toBe(0)
    expect(lastProps().ok).toBe(false)
  })
})
