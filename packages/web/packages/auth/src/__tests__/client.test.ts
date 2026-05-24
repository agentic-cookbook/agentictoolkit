import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { configureAuth } from '../config'
import { writeTokens } from '../tokens'
import { invalidateRefresh } from '../refresh'
import { authedJson, extractErrorMessage } from '../client'

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
