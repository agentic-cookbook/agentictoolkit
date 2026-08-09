import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  beginLogin,
  ssoLogout,
  ssoSwitchUrl,
  stripSsoFragment,
  takeReturnTo,
  centralEmailLogin,
  readCentralParams,
  beginLinkProvider,
  providerSigninUrl,
} from '../sso'

// Mirror of the private key in sso.ts — the stash beginLogin/takeReturnTo share.
const RETURN_TO_KEY = 'adh_sso_return_to'

// beginLogin reads window.location.origin and assigns window.location.href.
// jsdom's real location can't be navigated, so swap in a plain stand-in we can
// read the assigned href back from.
let savedLocation: PropertyDescriptor | undefined
function stubLocation(origin: string): { href: string } {
  const loc = { origin, href: '' }
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
  return loc
}

beforeEach(() => {
  savedLocation = Object.getOwnPropertyDescriptor(window, 'location')
  window.sessionStorage.clear()
  delete process.env.NEXT_PUBLIC_AUTH_API_URL
})

afterEach(() => {
  if (savedLocation) Object.defineProperty(window, 'location', savedLocation)
})

describe('beginLogin', () => {
  it('navigates to the configured AS /authorize with clientId + callback return', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://cookbook.example.com')

    beginLogin({ clientId: 'cookbook' })

    const url = new URL(loc.href)
    expect(url.origin).toBe('https://api.hub.example.com')
    expect(url.pathname).toBe('/oauth/signin/authorize')
    expect(url.searchParams.get('clientId')).toBe('cookbook')
    expect(url.searchParams.get('return')).toBe('https://cookbook.example.com/auth/callback')
  })

  it("defaults clientId to 'adh'", () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://site.example.com')

    beginLogin()

    expect(new URL(loc.href).searchParams.get('clientId')).toBe('adh')
  })

  it('prefers an explicit authApiBase over the env var and trims trailing slashes', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://env.example.com'
    const loc = stubLocation('https://site.example.com')

    beginLogin({ authApiBase: 'https://explicit.example.com///' })

    expect(new URL(loc.href).origin).toBe('https://explicit.example.com')
  })

  it('honors a custom callbackPath in the return URL', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://site.example.com')

    beginLogin({ callbackPath: '/sso/done' })

    expect(new URL(loc.href).searchParams.get('return')).toBe('https://site.example.com/sso/done')
  })

  it('falls back to the same-origin BFF proxy when no AS base is configured', () => {
    const loc = stubLocation('https://site.example.com')

    beginLogin({ clientId: 'adh' })

    // Relative target → resolves against the current origin.
    const url = new URL(loc.href, 'https://site.example.com')
    expect(url.origin).toBe('https://site.example.com')
    expect(url.pathname).toBe('/api/oauth/signin/authorize')
    expect(url.searchParams.get('return')).toBe('https://site.example.com/auth/callback')
  })

  it('stashes returnTo so the callback can restore it', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    stubLocation('https://site.example.com')

    beginLogin({ returnTo: '/settings' })

    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBe('/settings')
  })

  it('does not stash anything when returnTo is omitted', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    stubLocation('https://site.example.com')

    beginLogin()

    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBeNull()
  })
})

describe('providerSigninUrl', () => {
  // The `/start` contract has two consumers that must not drift: LoginCard's provider
  // buttons and the hub's own signup page. Sign-in and sign-up are the SAME request —
  // the backend JIT-creates the account and enforces `new_user_signups` there — so
  // there is one builder, and these are its terms.
  it('names the AS /oauth/signin/start with clientId, providerId and return', () => {
    const url = new URL(
      providerSigninUrl({
        clientId: 'adh',
        providerId: 'github',
        returnUrl: 'https://hub.example.com/auth/callback',
        authApiBase: 'https://api.hub.example.com',
      }),
    )
    expect(url.origin).toBe('https://api.hub.example.com')
    expect(url.pathname).toBe('/oauth/signin/start')
    expect(url.searchParams.get('clientId')).toBe('adh')
    expect(url.searchParams.get('providerId')).toBe('github')
    expect(url.searchParams.get('return')).toBe('https://hub.example.com/auth/callback')
  })

  it('falls back to the same-origin BFF proxy when no AS base is configured (local dev)', () => {
    const url = new URL(
      providerSigninUrl({ clientId: 'adh', providerId: 'google', returnUrl: 'https://s.example.com/auth/callback' }),
      'https://s.example.com',
    )
    expect(url.pathname).toBe('/api/oauth/signin/start')
  })

  // The rule an OMITTED base follows, and the reason LoginCard's prop is not
  // prop-only: with the env var inlined, no argument still means the AS host, so
  // /start and /callback share it (the OAuth state cookie is host-only). Only a
  // build with NEITHER falls through to the same-origin proxy above.
  it('falls back to the env AS base — not the proxy — when no base is passed', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://env.example.com'
    const url = new URL(
      providerSigninUrl({ clientId: 'adh', providerId: 'github', returnUrl: 'https://s.example.com/auth/callback' }),
    )
    expect(url.origin).toBe('https://env.example.com')
    expect(url.pathname).toBe('/oauth/signin/start')
  })

  it('prefers an explicit authApiBase over the env var and trims trailing slashes', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://env.example.com'
    const url = new URL(
      providerSigninUrl({
        clientId: 'adh',
        providerId: 'gitlab',
        returnUrl: 'https://s.example.com/auth/callback',
        authApiBase: 'https://explicit.example.com///',
      }),
    )
    expect(url.origin).toBe('https://explicit.example.com')
    expect(url.pathname).toBe('/oauth/signin/start')
  })
})

describe('ssoLogout', () => {
  it('navigates to the configured AS /logout with clientId + return on this origin', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://cookbook.example.com')

    ssoLogout({ clientId: 'cookbook' })

    const url = new URL(loc.href)
    expect(url.origin).toBe('https://api.hub.example.com')
    expect(url.pathname).toBe('/oauth/signin/logout')
    expect(url.searchParams.get('clientId')).toBe('cookbook')
    expect(url.searchParams.get('return')).toBe('https://cookbook.example.com/')
  })

  it("defaults clientId to 'adh' and returnTo to the site root", () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://site.example.com')

    ssoLogout()

    const url = new URL(loc.href)
    expect(url.searchParams.get('clientId')).toBe('adh')
    expect(url.searchParams.get('return')).toBe('https://site.example.com/')
  })

  it('honors a custom returnTo on the current origin', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://site.example.com')

    ssoLogout({ returnTo: '/goodbye' })

    expect(new URL(loc.href).searchParams.get('return')).toBe('https://site.example.com/goodbye')
  })

  it('prefers an explicit authApiBase over the env var and trims trailing slashes', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://env.example.com'
    const loc = stubLocation('https://site.example.com')

    ssoLogout({ authApiBase: 'https://explicit.example.com///' })

    expect(new URL(loc.href).origin).toBe('https://explicit.example.com')
  })

  it('falls back to the same-origin BFF proxy when no AS base is configured', () => {
    const loc = stubLocation('https://site.example.com')

    ssoLogout({ clientId: 'adh' })

    const url = new URL(loc.href, 'https://site.example.com')
    expect(url.origin).toBe('https://site.example.com')
    expect(url.pathname).toBe('/api/oauth/signin/logout')
  })
})

describe('readCentralParams', () => {
  it('reads clientId + returnUrl from the AS-appended query', () => {
    expect(
      readCentralParams('?clientId=admin&return=https%3A%2F%2Fadmin.example.com%2Fauth%2Fcallback'),
    ).toEqual({ clientId: 'admin', returnUrl: 'https://admin.example.com/auth/callback' })
  })

  it("defaults clientId to 'adh' when only return is present", () => {
    expect(readCentralParams('?return=https%3A%2F%2Fx.example.com%2Fcb')).toEqual({
      clientId: 'adh',
      returnUrl: 'https://x.example.com/cb',
    })
  })

  it('returns null without a return — a plain direct (in-site) login', () => {
    expect(readCentralParams('?clientId=adh')).toBeNull()
    expect(readCentralParams('')).toBeNull()
  })
})

describe('centralEmailLogin', () => {
  let savedFetch: typeof globalThis.fetch
  beforeEach(() => {
    savedFetch = globalThis.fetch
  })
  afterEach(() => {
    globalThis.fetch = savedFetch
  })

  function stubFetch(
    body: unknown,
    status = 200,
  ): Array<{ url: string; init?: RequestInit }> {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    return calls
  }

  it('POSTs the AS /login with clientId+return and navigates to the redirectUrl', async () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://hub.example.com')
    const calls = stubFetch({ redirectUrl: 'https://bitbag.example.com/auth/callback#code=abc' })

    await centralEmailLogin({
      clientId: 'adh',
      returnUrl: 'https://bitbag.example.com/auth/callback',
      identifier: 'a@b.com',
      password: 'pw',
    })

    expect(calls[0]!.url).toBe('https://api.hub.example.com/oauth/signin/login')
    expect(calls[0]!.init?.credentials).toBe('include') // so the central cookie is stored
    expect(JSON.parse(calls[0]!.init!.body as string)).toMatchObject({
      // The generic `identifier` wire key (never the legacy `email`, which would pin the
      // AS lookup to email-only) — the AS classifies email / slug / phone itself.
      identifier: 'a@b.com',
      password: 'pw',
      clientId: 'adh',
      return: 'https://bitbag.example.com/auth/callback',
    })
    // Funnels the exchange code back to the BRAND site, not the hub.
    expect(loc.href).toBe('https://bitbag.example.com/auth/callback#code=abc')
  })

  it('forwards the admin clientId unchanged', async () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    stubLocation('https://hub.example.com')
    const calls = stubFetch({ redirectUrl: 'https://admin.example.com/auth/callback#code=z' })

    await centralEmailLogin({
      clientId: 'admin',
      returnUrl: 'https://admin.example.com/auth/callback',
      identifier: 'root',
      password: 'pw',
    })

    expect(JSON.parse(calls[0]!.init!.body as string).clientId).toBe('admin')
  })

  it('falls back to the same-origin BFF proxy when no AS base is configured', async () => {
    const loc = stubLocation('https://hub.example.com')
    const calls = stubFetch({ redirectUrl: 'https://x.example.com/cb#code=1' })

    await centralEmailLogin({
      clientId: 'adh',
      returnUrl: 'https://x.example.com/cb',
      identifier: 'a',
      password: 'b',
    })

    expect(calls[0]!.url).toBe('/api/oauth/signin/login')
    expect(loc.href).toBe('https://x.example.com/cb#code=1')
  })

  it('throws the server message and does NOT navigate on failure', async () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    const loc = stubLocation('https://hub.example.com')
    stubFetch({ message: 'invalid credentials' }, 401)

    await expect(
      centralEmailLogin({
        clientId: 'adh',
        returnUrl: 'https://x.example.com/cb',
        identifier: 'a',
        password: 'b',
      }),
    ).rejects.toThrow('invalid credentials')
    expect(loc.href).toBe('') // never navigated
  })
})

describe('takeReturnTo', () => {
  it('reads and clears the stashed destination (single use)', () => {
    window.sessionStorage.setItem(RETURN_TO_KEY, '/home/x')

    expect(takeReturnTo()).toBe('/home/x')
    expect(takeReturnTo()).toBeNull()
    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBeNull()
  })

  it('returns null when nothing was stashed', () => {
    expect(takeReturnTo()).toBeNull()
  })

  // SEC-M8: the stashed value is often the raw page pathname; a protocol-relative `//evil.com`
  // resolves cross-origin and would become an open redirect when fed to location.replace.
  it('rejects a cross-origin (protocol-relative) stashed destination', () => {
    window.sessionStorage.setItem(RETURN_TO_KEY, '//evil.com/phish')
    expect(takeReturnTo()).toBeNull()
    // consumed (single-use) even when rejected, so a poisoned value can't linger.
    expect(window.sessionStorage.getItem(RETURN_TO_KEY)).toBeNull()
  })

  it('rejects an absolute cross-origin URL', () => {
    window.sessionStorage.setItem(RETURN_TO_KEY, 'https://evil.example.com/x')
    expect(takeReturnTo()).toBeNull()
  })

  it('reduces an absolute same-origin URL to a relative path', () => {
    stubLocation('https://site.example.com')
    window.sessionStorage.setItem(RETURN_TO_KEY, 'https://site.example.com/home?x=1#y')
    expect(takeReturnTo()).toBe('/home?x=1#y')
  })

  it('round-trips with beginLogin', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'
    stubLocation('https://site.example.com')

    beginLogin({ returnTo: '/dashboard' })

    expect(takeReturnTo()).toBe('/dashboard')
  })
})

describe('ssoSwitchUrl', () => {
  it('wraps a destination into a prompt=none authorize whose return IS the destination', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'

    const wrapped = ssoSwitchUrl('https://cookbook.example.com/home', { clientId: 'adh' })

    const url = new URL(wrapped)
    expect(url.origin + url.pathname).toBe('https://api.hub.example.com/oauth/signin/authorize')
    expect(url.searchParams.get('clientId')).toBe('adh')
    expect(url.searchParams.get('prompt')).toBe('none')
    // The destination page is the return target, so the AS bounces the #code
    // straight there and that page's AuthProvider exchanges it in place.
    expect(url.searchParams.get('return')).toBe('https://cookbook.example.com/home')
  })

  it("defaults clientId to 'adh'", () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.hub.example.com'

    const url = new URL(ssoSwitchUrl('https://site.example.com/'))

    expect(url.searchParams.get('clientId')).toBe('adh')
  })

  it('returns the destination UNCHANGED when no AS base is configured (local dev)', () => {
    // No NEXT_PUBLIC_AUTH_API_URL ⇒ cross-origin silent SSO is unreachable, so
    // the switch is a plain navigation to the destination, same as before.
    expect(ssoSwitchUrl('https://site.example.com/home')).toBe('https://site.example.com/home')
  })
})

describe('stripSsoFragment', () => {
  it('removes a bare #code / #error fragment entirely', () => {
    expect(stripSsoFragment('#code=abc')).toBe('')
    expect(stripSsoFragment('#error=login_required')).toBe('')
    expect(stripSsoFragment('')).toBe('')
  })

  it('KEEPS the #site-switch up-walk marker when the AS appended a code to it', () => {
    // The AS bounces a deep site-switch as `…#site-switch&code=…`; the marker must
    // survive the in-place strip so SiteNotFound can still walk the path up.
    expect(stripSsoFragment('#site-switch&code=abc')).toBe('#site-switch')
    expect(stripSsoFragment('#site-switch&error=login_required')).toBe('#site-switch')
  })

  it('keeps a legitimate scroll anchor that rode alongside the code', () => {
    expect(stripSsoFragment('#section-2&code=abc')).toBe('#section-2')
    expect(stripSsoFragment('#site-switch')).toBe('#site-switch')
  })
})

describe('beginLinkProvider', () => {
  it('navigates to the AS /oauth/signin/start in link mode and stashes a CSRF nonce', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://as.example.com'
    const loc = stubLocation('https://hub.example.com')
    beginLinkProvider({ providerId: 'github', returnTo: '/home' })
    const u = new URL(loc.href)
    expect(u.origin + u.pathname).toBe('https://as.example.com/oauth/signin/start')
    expect(u.searchParams.get('link')).toBe('1')
    expect(u.searchParams.get('clientId')).toBe('adh')
    expect(u.searchParams.get('providerId')).toBe('github')
    expect(u.searchParams.get('return')).toBe('https://hub.example.com/home')
    // The unguessable nonce is both sent and stashed, so the completing page can
    // prove the #link_code belongs to a flow this browser started.
    const nonce = u.searchParams.get('linkNonce')
    expect(nonce).toBeTruthy()
    expect(window.sessionStorage.getItem('adh_link_nonce')).toBe(nonce)
  })

  it('falls back to the same-origin proxy when no AS base is configured', () => {
    const loc = stubLocation('https://hub.example.com')
    expect(beginLinkProvider({ providerId: 'github', returnTo: '/home' })).toBe(true)
    const u = new URL(loc.href, 'https://hub.example.com')
    expect(u.pathname).toBe('/api/oauth/signin/start')
  })

  it('returns false and does NOT navigate when the CSRF nonce cannot be stashed', () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://as.example.com'
    const loc = stubLocation('https://hub.example.com')
    const spy = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    try {
      expect(beginLinkProvider({ providerId: 'github', returnTo: '/home' })).toBe(false)
      expect(loc.href).toBe('') // never navigated — no doomed round-trip
    } finally {
      spy.mockRestore()
    }
  })
})
