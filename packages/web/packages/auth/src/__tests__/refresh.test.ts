import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { configureAuth } from '../config'
import { writeTokens, readTokens, clearTokens } from '../tokens'
import { refreshAccessToken, invalidateRefresh } from '../refresh'

beforeEach(() => {
  localStorage.clear()
  configureAuth({ storageKey: 'test_tokens', refreshPath: '/api/auth/refresh' })
  invalidateRefresh()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('refreshAccessToken', () => {
  it('dedups concurrent callers into one fetch and writes the new token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'NEW' }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: '{}',
    }))
    expect(a).toBe('NEW')
    expect(b).toBe('NEW')
    expect(readTokens()?.accessToken).toBe('NEW')
  })

  it('clears tokens and returns null on a non-OK response', async () => {
    vi.useFakeTimers()
    try {
      writeTokens({ accessToken: 'OLD', refreshToken: '' })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response))

      const p = refreshAccessToken()
      // Nothing else writes during the loser-race recheck window → it clears.
      await vi.advanceTimersByTimeAsync(500)
      const result = await p

      expect(result).toBeNull()
      expect(readTokens()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  // A9(a) — session resurrection. A refresh starts against a valid token; a hub
  // logout then clears the shared key WITHOUT bumping this module's generation;
  // the in-flight success must NOT re-write tokens (compare-and-swap fails).
  it('does not resurrect the session when logout clears tokens mid-refresh', async () => {
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    let resolveFetch!: (r: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => { resolveFetch = r })),
    )

    const p = refreshAccessToken() // captures startAccessToken = 'OLD'
    clearTokens() // logout mid-flight (shared key cleared; generation untouched)
    resolveFetch({ ok: true, json: async () => ({ token: 'NEW' }) } as Response)

    expect(await p).toBeNull()
    expect(readTokens()).toBeNull() // 'NEW' was NOT written back
  })

  // A9(a) — a concurrent refresher / fresh login wrote a DIFFERENT token mid-flight;
  // this success must adopt that token, not clobber it with its own.
  it('adopts a token written by a concurrent writer instead of clobbering it', async () => {
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    let resolveFetch!: (r: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => { resolveFetch = r })),
    )

    const p = refreshAccessToken() // captures startAccessToken = 'OLD'
    writeTokens({ accessToken: 'NEWER', refreshToken: '' }) // another writer wins
    resolveFetch({ ok: true, json: async () => ({ token: 'NEW' }) } as Response)

    expect(await p).toBe('NEWER')
    expect(readTokens()?.accessToken).toBe('NEWER') // not clobbered by 'NEW'
  })

  // A9(b) — failure-path loser race: the winner's writeTokens lands DURING the
  // recheck delay after our 401; adopt it instead of clearing a valid session.
  it('adopts a delayed winner token on the failure path instead of clearing', async () => {
    vi.useFakeTimers()
    try {
      writeTokens({ accessToken: 'OLD', refreshToken: '' })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response))

      const p = refreshAccessToken()
      // Let the 401 + the immediate re-check run and reach the recheck delay.
      await vi.advanceTimersByTimeAsync(0)
      // The winner's write lands during the wait window.
      writeTokens({ accessToken: 'WINNER', refreshToken: '' })
      await vi.advanceTimersByTimeAsync(300)

      expect(await p).toBe('WINNER')
      expect(readTokens()?.accessToken).toBe('WINNER') // not cleared
    } finally {
      vi.useRealTimers()
    }
  })
})
