import { describe, it, expect, beforeEach } from 'vitest'
import { configureAuth, authConfig } from '../config'
import {
  tokensFromResponse,
  readTokens,
  writeTokens,
  clearTokens,
  readAccessToken,
  decodeBase64UrlJson,
  readTokenSubject,
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

/**
 * The base64url→JSON decode, which three places in two packages had written for themselves
 * and all three had written the same way: `JSON.parse(atob(segment))`.
 *
 * `atob` returns a BINARY STRING — one code unit per byte — so a claim carrying anything
 * outside ASCII arrives as its UTF-8 bytes reinterpreted as Latin-1. A display name is the
 * ordinary carrier, and the failure is silent in the shape that matters most: `JSON.parse`
 * accepts the mojibake and hands back a plausible object with a corrupted value. When a byte
 * sequence happens not to be valid JSON afterwards it throws instead, which the callers read
 * as "malformed token" — the same answer they give a token that is genuinely garbage.
 */
describe('decodeBase64UrlJson', () => {
  /** base64url of a UTF-8 encoding — what a backend actually mints, and what `btoa` alone
   *  cannot produce: `btoa` throws outright on a string with a code point above 0xFF. */
  const b64url = (json: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  it('reads a plain ASCII payload', () => {
    expect(decodeBase64UrlJson(b64url(JSON.stringify({ sub: 'user-1' })))).toEqual({
      sub: 'user-1',
    })
  })

  it('reads a multi-byte payload as the text it is, not as its bytes', () => {
    // Two bytes and three bytes per character respectively; the old decode returned
    // 'JosÃ©' for the first and threw on the second.
    expect(decodeBase64UrlJson(b64url(JSON.stringify({ name: 'José' })))).toEqual({
      name: 'José',
    })
    expect(decodeBase64UrlJson(b64url(JSON.stringify({ name: '東京' })))).toEqual({
      name: '東京',
    })
  })

  it('tolerates a segment whose padding was stripped, which is every real one', () => {
    // `iat` is there to make the JSON a length that needs padding back; a decoder that
    // forgot the padding threw on roughly three payloads in four.
    const claims = { sub: 'u', iat: 1 }
    expect(decodeBase64UrlJson(b64url(JSON.stringify(claims)))).toEqual(claims)
  })

  it('returns null rather than throwing on anything it cannot read', () => {
    expect(decodeBase64UrlJson('not base64!!')).toBeNull()
    expect(decodeBase64UrlJson(b64url('{ not json'))).toBeNull()
    expect(decodeBase64UrlJson('')).toBeNull()
    // Refused, NOT substituted: these segments are signed, so a decoder that quietly
    // replaced an invalid byte with U+FFFD would hand back a claim the issuer never made.
    // (0xFF is not a legal UTF-8 lead byte.)
    expect(decodeBase64UrlJson(btoa('\xff\xfe'))).toBeNull()
  })

  it("is what readTokenSubject reads its claims with", () => {
    writeTokens({
      accessToken: `x.${b64url(JSON.stringify({ sub: 'user-1', name: '東京' }))}.y`,
      refreshToken: '',
    })
    expect(readTokenSubject()).toBe('user-1')
  })

  it('has no subject to report when the token is absent or malformed', () => {
    clearTokens()
    expect(readTokenSubject()).toBeNull()
    writeTokens({ accessToken: 'garbage', refreshToken: '' })
    expect(readTokenSubject()).toBeNull()
    writeTokens({ accessToken: `x.${b64url(JSON.stringify({ sub: 7 }))}.y`, refreshToken: '' })
    expect(readTokenSubject()).toBeNull()
  })
})
