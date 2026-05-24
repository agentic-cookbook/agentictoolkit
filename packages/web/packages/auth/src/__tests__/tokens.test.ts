import { describe, it, expect, beforeEach } from 'vitest'
import { configureAuth, authConfig } from '../config'
import {
  tokensFromResponse,
  readTokens,
  writeTokens,
  clearTokens,
  readAccessToken,
} from '../tokens'

beforeEach(() => {
  localStorage.clear()
  configureAuth({ storageKey: 'test_tokens', refreshPath: '/api/auth/refresh' })
})

describe('tokensFromResponse', () => {
  it('prefers accessToken, falls back to token, blanks refreshToken', () => {
    expect(tokensFromResponse({ accessToken: 'A' })).toEqual({ accessToken: 'A', refreshToken: '' })
    expect(tokensFromResponse({ token: 'T' })).toEqual({ accessToken: 'T', refreshToken: '' })
    expect(tokensFromResponse({ accessToken: 'A', token: 'T' })).toEqual({ accessToken: 'A', refreshToken: '' })
  })

  it('throws when neither field is present', () => {
    expect(() => tokensFromResponse({})).toThrow(/missing token/i)
  })
})

describe('storage', () => {
  it('round-trips under the configured key', () => {
    writeTokens({ accessToken: 'A', refreshToken: '' })
    expect(localStorage.getItem('test_tokens')).toContain('"accessToken":"A"')
    expect(readTokens()).toEqual({ accessToken: 'A', refreshToken: '' })
    expect(readAccessToken()).toBe('A')
    clearTokens()
    expect(readTokens()).toBeNull()
    expect(readAccessToken()).toBeNull()
  })

  it('honors a re-configured key', () => {
    configureAuth({ storageKey: 'other_key' })
    writeTokens({ accessToken: 'B', refreshToken: '' })
    expect(localStorage.getItem('other_key')).toBeTruthy()
    expect(localStorage.getItem('test_tokens')).toBeNull()
    expect(authConfig().storageKey).toBe('other_key')
  })

  it('returns null on malformed JSON', () => {
    localStorage.setItem('test_tokens', 'not json')
    expect(readTokens()).toBeNull()
  })
})
