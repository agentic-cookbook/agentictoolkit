import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { configureAuth } from '../config'
import { writeTokens } from '../tokens'
import { linkProvider } from '../client'

beforeEach(() => { configureAuth({ storageKey: 'test_tokens' }); writeTokens({ accessToken: 'at', refreshToken: '' }) })
afterEach(() => vi.unstubAllGlobals())

describe('linkProvider', () => {
  it('POSTs to /api/auth/link-provider with the bearer token and body', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ linked: true }), { status: 200, headers: { 'content-type': 'application/json' } }) }))
    await linkProvider({ clientSlug: 'adh', providerSlug: 'github', code: 'c1', redirectUri: 'https://as/cb' })
    expect(calls[0]!.url).toBe('/api/auth/link-provider')
    expect(calls[0]!.init.method).toBe('POST')
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer at')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ clientSlug: 'adh', providerSlug: 'github', code: 'c1', redirectUri: 'https://as/cb' })
  })
  it('throws on a 409 conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'already linked to another account' }), { status: 409, headers: { 'content-type': 'application/json' } })))
    await expect(linkProvider({ clientSlug: 'adh', providerSlug: 'github', code: 'c', redirectUri: 'u' })).rejects.toThrow()
  })
})
