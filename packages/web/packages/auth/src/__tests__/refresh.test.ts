import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { configureAuth } from '../config'
import { writeTokens, readTokens } from '../tokens'
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
    writeTokens({ accessToken: 'OLD', refreshToken: '' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(readTokens()).toBeNull()
  })
})
