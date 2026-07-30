import { describe, it, expect, vi, beforeEach } from 'vitest'

const captureMock = vi.hoisted(() => vi.fn())
vi.mock('posthog-js', () => ({ default: { capture: captureMock } }))

import {
  scrubPath,
  captureEvent,
  setPosthogReady,
  markRetriedRequest,
  consumeRetriedFlag,
  EVENT_HTTP_REQUEST,
} from '../telemetry/analytics'

describe('scrubPath', () => {
  it('redacts UUID and long-numeric segments and strips query/hash', () => {
    expect(scrubPath('/api/persona/services/3f8b1c2d-1234-4abc-89de-0123456789ab')).toBe(
      '/api/persona/services/:id',
    )
    expect(scrubPath('/api/users/123456?token=secret#frag')).toBe('/api/users/:id')
    expect(scrubPath('https://api.example.com/api/auth/me?q=1')).toBe('/api/auth/me')
  })

  it('keeps low-cardinality segments (versions, short numbers up to 3 digits, words)', () => {
    expect(scrubPath('/api/v2/items/42')).toBe('/api/v2/items/42')
    expect(scrubPath('/api/items/123')).toBe('/api/items/123') // 3 digits: kept (threshold is 4)
  })

  it('redacts ids embedded inside a segment, not just whole segments', () => {
    expect(scrubPath('/api/users/user-123456/posts')).toBe('/api/users/user-:id/posts')
    expect(scrubPath('/api/order_3f8b1c2d-1234-4abc-89de-0123456789ab')).toBe('/api/order_:id')
  })

  it('never emits the "pathname" of a non-http(s) URL (data:/mailto:/blob:)', () => {
    expect(scrubPath('data:text/plain,secret')).toBe(':non-http')
    expect(scrubPath('mailto:jane@example.com')).toBe(':non-http')
  })
})

describe('captureEvent', () => {
  beforeEach(() => {
    captureMock.mockClear()
    setPosthogReady(false)
  })

  it('does not reach PostHog until initialized', () => {
    captureEvent('x', { a: 1 })
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('captures once PostHog is ready', () => {
    setPosthogReady(true)
    captureEvent(EVENT_HTTP_REQUEST, { path: '/api/x', status: 200 })
    expect(captureMock).toHaveBeenCalledWith(EVENT_HTTP_REQUEST, { path: '/api/x', status: 200 })
  })

  it('never throws even if posthog.capture throws', () => {
    setPosthogReady(true)
    captureMock.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => captureEvent('x', {})).not.toThrow()
  })
})

describe('retry marker', () => {
  it('round-trips on the same init object and clears after consume', () => {
    const init = { method: 'GET' }
    markRetriedRequest(init)
    expect(consumeRetriedFlag(init)).toBe(true)
    expect(consumeRetriedFlag(init)).toBe(false)
  })

  it('is false for an unmarked init or a non-object', () => {
    expect(consumeRetriedFlag({})).toBe(false)
    expect(consumeRetriedFlag(undefined)).toBe(false)
  })
})
