import { describe, it, expect } from 'vitest'
import { resolveBackendUrl } from '../server/proxy'

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
