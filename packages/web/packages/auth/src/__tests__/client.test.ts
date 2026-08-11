import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { configureAuth } from '../config'
import { writeTokens } from '../tokens'
import { invalidateRefresh } from '../refresh'
import { authedFetch, authedJson, exchangeSsoCode, extractErrorMessage, AuthHttpError } from '../client'

beforeEach(() => {
  localStorage.clear()
  configureAuth({ storageKey: 'test_tokens', refreshPath: '/api/auth/refresh' })
  invalidateRefresh()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('extractErrorMessage', () => {
  it('reads error/message/title in order, else fallback', () => {
    expect(extractErrorMessage({ error: 'E' }, 'fb')).toBe('E')
    expect(extractErrorMessage({ message: 'M' }, 'fb')).toBe('M')
    expect(extractErrorMessage({ title: 'T' }, 'fb')).toBe('T')
    expect(extractErrorMessage({}, 'fb')).toBe('fb')
    expect(extractErrorMessage(null, 'fb')).toBe('fb')
  })
})

describe('exchangeSsoCode', () => {
  const session = {
    ok: true,
    status: 200,
    json: async () => ({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'a@b.com', name: 'A' },
    }),
  } as Response

  it('retries once after a network-level failure, then succeeds', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn()
        // The request never completed (connection drop / offline blip) — the
        // one-time code was never consumed, so a retry can still redeem it.
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(session)
      vi.stubGlobal('fetch', fetchMock)

      const promise = exchangeSsoCode('code-1')
      await vi.runAllTimersAsync()
      const { tokens, user } = await promise

      expect(tokens.accessToken).toBe('access-token')
      expect(user.id).toBe('u1')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up after one retry when the network stays down', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      vi.stubGlobal('fetch', fetchMock)

      const promise = exchangeSsoCode('code-1')
      // Attach the rejection expectation BEFORE advancing timers so the
      // rejection is never unhandled.
      const outcome = expect(promise).rejects.toThrow('Failed to fetch')
      await vi.runAllTimersAsync()
      await outcome
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT retry an HTTP error (the code is spent — a re-POST cannot help)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid or expired exchange code' } }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(exchangeSsoCode('code-1')).rejects.toThrow('invalid or expired exchange code')
    await expect(exchangeSsoCode('code-1')).rejects.toBeInstanceOf(AuthHttpError)
    expect(fetchMock).toHaveBeenCalledTimes(2) // once per call above — no internal retry
  })
})

describe('authedFetch', () => {
  it('works with no init at all — a bare GET should not require callers to pass {}', async () => {
    // rawFetch reads `init.headers`/`init.body` unconditionally. Before `init` defaulted to
    // `{}`, calling authedFetch(url) with no second argument was a type error for every
    // in-repo caller, but nothing stopped a structurally-compatible fetcher type (e.g.
    // @agentic-toolkit/registry's `Fetcher`, whose `init` is optional) from calling it with
    // none at runtime — which would have thrown reading `.headers` off `undefined`.
    writeTokens({ accessToken: 'TOK', refreshToken: '' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ hi: 1 }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const res = await authedFetch('/api/x')

    expect(res.status).toBe(200)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOK')
  })
})

describe('authedJson', () => {
  it('attaches the Bearer header and returns parsed JSON', async () => {
    writeTokens({ accessToken: 'TOK', refreshToken: '' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ hi: 1 }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const data = await authedJson<{ hi: number }>('/api/x')

    expect(data).toEqual({ hi: 1 })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOK')
  })

  it('on 401 refreshes once and retries with the new token', async () => {
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    const fetchMock = vi.fn()
      // first call → 401
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response)
      // refresh call → new token
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'NEW' }) } as Response)
      // retry → 200
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const data = await authedJson<{ ok: boolean }>('/api/x')

    expect(data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer NEW')
  })

  it('throws a message extracted from the error body', async () => {
    writeTokens({ accessToken: 'TOK', refreshToken: '' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ error: 'boom' }),
    } as Response))

    await expect(authedJson('/api/x')).rejects.toThrow('boom')
  })
})
