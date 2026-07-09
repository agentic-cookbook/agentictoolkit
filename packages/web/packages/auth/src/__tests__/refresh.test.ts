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
  vi.useRealTimers()
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

  it('clears tokens and returns null on a non-OK response with no concurrent winner', async () => {
    vi.useFakeTimers()
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response))

    const p = refreshAccessToken()
    await vi.advanceTimersByTimeAsync(300) // drain the loser-race wait window

    expect(await p).toBeNull()
    expect(readTokens()).toBeNull()
  })

  it('does NOT resurrect the session when logout clears tokens mid-refresh', async () => {
    // Session-resurrection guard: a 401 kicks off a refresh; the user logs out
    // (clearTokens) while it is in-flight; the 200 must NOT re-populate storage.
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    let resolveFetch!: (r: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((r) => (resolveFetch = r))),
    )

    const p = refreshAccessToken()
    clearTokens() // logout mid-flight
    resolveFetch({ ok: true, json: async () => ({ token: 'NEW' }) } as Response)

    expect(await p).toBeNull()
    expect(readTokens()).toBeNull()
  })

  it('adopts a concurrently-written token on success instead of clobbering it', async () => {
    // Another refresher / a fresh login wrote a new token while this refresh was
    // in-flight; the winner's token must be adopted, not overwritten by ours.
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    let resolveFetch!: (r: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((r) => (resolveFetch = r))),
    )

    const p = refreshAccessToken()
    writeTokens({ accessToken: 'WINNER', refreshToken: '' }) // a concurrent winner
    resolveFetch({ ok: true, json: async () => ({ token: 'MINE' }) } as Response)

    expect(await p).toBe('WINNER')
    expect(readTokens()?.accessToken).toBe('WINNER')
  })

  it('failure path: waits for a delayed concurrent winner and adopts it before clearing', async () => {
    // Loser-race window: the loser 401s first, but the winner's writeTokens has not
    // landed yet. The loser must wait, re-read, and adopt the winner — not clear.
    vi.useFakeTimers()
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response))

    const p = refreshAccessToken()
    await vi.advanceTimersByTimeAsync(0) // flush fetch + first (immediate) re-check → parked in the wait
    writeTokens({ accessToken: 'WINNER', refreshToken: '' }) // winner lands DURING the wait
    await vi.advanceTimersByTimeAsync(300)

    expect(await p).toBe('WINNER')
    expect(readTokens()?.accessToken).toBe('WINNER')
  })
})
