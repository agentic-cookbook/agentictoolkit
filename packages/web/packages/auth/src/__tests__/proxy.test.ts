import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveBackendUrl, proxyToBackend } from '../server/proxy'

describe('resolveBackendUrl', () => {
  it('uses explicit API_BACKEND_URL when set', () => {
    expect(
      resolveBackendUrl({ API_BACKEND_URL: 'https://custom.example', NODE_ENV: 'production' }),
    ).toBe('https://custom.example')
  })

  it('defaults to the shared prod data API in production', () => {
    expect(resolveBackendUrl({ NODE_ENV: 'production' })).toBe(
      'https://api.agenticdeveloperhub.com',
    )
  })

  it('defaults to localhost in development', () => {
    expect(resolveBackendUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000')
  })

  it('defaults to localhost when NODE_ENV is unset', () => {
    expect(resolveBackendUrl({})).toBe('http://localhost:3000')
  })
})

describe('proxyToBackend content negotiation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Capture the Headers the proxy forwards upstream. */
  async function captureForwardedHeaders(browserAccept: string): Promise<Headers> {
    let seen: Headers | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        seen = init.headers as Headers
        return Promise.resolve(new Response('{}', { status: 200 }))
      }),
    )
    const req = new Request('https://site.example/api/oauth/signin/exchange', {
      method: 'POST',
      headers: { 'accept-encoding': browserAccept, 'content-type': 'application/json' },
      body: '{"code":"x"}',
    })
    await proxyToBackend(req, 'api', ['oauth', 'signin', 'exchange'])
    return seen as Headers
  }

  // Node's undici transparently DECODES a gzip/deflate response body but leaves
  // the upstream `content-encoding: gzip` on the Response it hands back. Since
  // proxyToBackend returns that Response verbatim, forwarding a browser's
  // `Accept-Encoding` makes the proxy declare an encoding the body no longer
  // has — the browser fails to decode it and `fetch` rejects with a TypeError.
  // Asking upstream for `identity` means there is never an encoding to lie
  // about; the CDN compresses on the way out to the browser.
  it('asks the backend for an unencoded body instead of forwarding the browser Accept-Encoding', async () => {
    const headers = await captureForwardedHeaders('gzip, deflate, br, zstd')
    expect(headers.get('accept-encoding')).toBe('identity')
  })

  it('overrides Accept-Encoding even when the browser asks only for gzip', async () => {
    const headers = await captureForwardedHeaders('gzip')
    expect(headers.get('accept-encoding')).toBe('identity')
  })
})
