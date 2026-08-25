import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  shouldSilentRestore,
  ssoHintPresent,
  beginSilentLogin,
  clearSsoChecked,
  preflightSsoReturn,
} from '../sso'

// Guards for the cold-load silent SSO restore. The gating is safety-critical: the
// AuthProvider runs on every brand site, so the rules here decide what a visitor
// sees on a page they asked for by name.
//
// The division of labour is the thing to keep straight, because it used to be one
// job done twice with guesses:
//
//   shouldSilentRestore  — is a probe WORTH it? (do we have positive evidence of a
//                          central session, or no way to read one?)
//   preflightSsoReturn   — is a probe SAFE? (will the AS bounce the browser back to
//                          this origin, or strand it on the central login page?)
//
// Only the AS can answer the second, so it is asked rather than guessed. That is
// what allows a probe on a public landing route, which a guess never could.

let savedLocation: PropertyDescriptor | undefined
function stubLocation(origin: string, pathname = '/dashboard', search = ''): { href: string } {
  // hostname is derived from the origin, not passed separately, so a test can't
  // stub a host that contradicts its own origin.
  const loc = { origin, hostname: new URL(origin).hostname, pathname, search, href: '' }
  savedLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
  return loc
}

function setHint(present: boolean): void {
  document.cookie = present
    ? 'adh_sso_hint=1'
    : 'adh_sso_hint=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

/** A fetch stub answering the preflight with `allowed`. */
function preflightFetch(allowed: boolean): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ allowed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

/** The arguments a {@link preflightFetch} stub was called with, first call.
 *
 * Throws when it was never called, rather than destructuring `undefined`: a test that
 * asserts on the URL of a request that never happened would otherwise fail on the
 * shape of the answer instead of on the missing request. `mock.calls[0]` is
 * `any[] | undefined` under `noUncheckedIndexedAccess`, so the check is required
 * anyway — this makes it say something. */
function preflightCall(fetchImpl: typeof fetch): [string, RequestInit] {
  const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls
  const first = calls[0]
  if (!first) throw new Error('the preflight fetch was never called')
  return [first[0] as string, (first[1] ?? {}) as RequestInit]
}

/** The AS host every hosted deploy and the dev suite both set. Configured is the
 *  NORMAL state — `fleet vercel backend-env` puts it on every Vercel project
 *  and `suite.toml` sets it locally — so it is the fixture default, and the two tests
 *  about its ABSENCE delete it and say why. It reads as cross-apex from `cookbook.com`
 *  and same-apex from `*.example.com`, which is what `isCrossApex` turns on. */
const AS = 'https://api.example.com'

beforeEach(() => {
  window.sessionStorage.clear()
  setHint(false)
  process.env.NEXT_PUBLIC_AUTH_API_URL = AS
})

afterEach(() => {
  if (savedLocation) Object.defineProperty(window, 'location', savedLocation)
  setHint(false)
})

describe('ssoHintPresent', () => {
  it('reflects the adh_sso_hint cookie', () => {
    expect(ssoHintPresent()).toBe(false)
    setHint(true)
    expect(ssoHintPresent()).toBe(true)
  })
})

describe('shouldSilentRestore', () => {
  it('true with a hint, no mid-flow fragment, and not yet checked', () => {
    setHint(true)
    stubLocation('https://status.example.com')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('false without the hint on a same-apex site — absence is CONCLUSIVE there', () => {
    // Same apex as the AS ⇒ the hint cookie is readable, and it is written whenever
    // the central session is. So no hint means there is no session to restore, and
    // a probe would spend a top-level redirect to learn nothing.
    stubLocation('https://api.example.com')
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('true for a cross-apex site even without a readable hint', () => {
    // A cross-apex site cannot read the hint at all, so its absence proves nothing
    // and asking is the only way to find an existing session.
    stubLocation('https://cookbook.com')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('false with no AS base configured, even WITH a hint saying a session exists', () => {
    // The central cookie is host-only on the AS host. With no base, buildAuthorizeUrl
    // falls back to this site's own /api proxy, where that cookie is invisible: the
    // probe could only ever come back empty, so it is not worth a redirect.
    //
    // Asserted with the hint PRESENT because that is the ordering claim: the base is
    // checked before any evidence, so the strongest possible evidence of a session
    // cannot talk the probe into a navigation that structurally cannot carry it.
    setHint(true)
    stubLocation('https://cookbook.com')
    delete process.env.NEXT_PUBLIC_AUTH_API_URL
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('says out loud that the variable is missing, once', async () => {
    // An unset var is a misconfigured DEPLOY, not a local convenience — one site had
    // it missing on all three tiers and the only symptom was a logged-out header, which
    // looks exactly like not being signed in. The build guard fails such a build now
    // (`@agentic-toolkit/next-preflight`'s `assertAuthApiUrl`); this is the runtime
    // half, and it names the
    // variable so the console says what to fix rather than that something declined.
    //
    // A FRESH module instance, because "once" is module state: any earlier test that
    // exercised the unset path has already spent the warning, and asserting on the
    // shared instance would pass or fail on test ORDER rather than on the behaviour.
    vi.resetModules()
    const fresh = await import('../sso')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      setHint(true)
      stubLocation('https://cookbook.com')
      delete process.env.NEXT_PUBLIC_AUTH_API_URL
      expect(fresh.shouldSilentRestore('')).toBe(false)
      expect(spy.mock.calls.length).toBe(1)
      expect(String(spy.mock.calls[0]?.[0])).toContain('NEXT_PUBLIC_AUTH_API_URL')
      // Once per page load, not once per decision: the header re-renders on every route
      // change, and a repeated console error would bury the rest of the page's output.
      fresh.shouldSilentRestore('')
      expect(spy.mock.calls.length).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('false mid-flow on the callback (#code / #error present)', () => {
    setHint(true)
    stubLocation('https://status.example.com')
    expect(shouldSilentRestore('#code=abc')).toBe(false)
    expect(shouldSilentRestore('#error=login_required')).toBe(false)
  })

  it('false once the tab has already checked (loop guard)', async () => {
    setHint(true)
    stubLocation('https://status.example.com')
    await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(true) })
    expect(shouldSilentRestore('')).toBe(false)
    clearSsoChecked()
    expect(shouldSilentRestore('')).toBe(true)
  })
})

// The landing routes are the whole reason this rule was rewritten. `/` and `/tour`
// used to refuse the probe outright, because a probe that cannot complete leaves a
// visitor who asked for a marketing page looking at a login form. That refusal was
// unconditional, so it also fired in the overwhelmingly common case where the probe
// WOULD have completed — and a signed-in visitor saw a logged-out header on the
// front page of every cross-apex site, which is the bug this replaces.
//
// The risk is now removed at its source (beginSilentLogin pre-flights) rather than
// by declining to look, so the landing deck restores a session like any other route.
describe('shouldSilentRestore on a landing page', () => {
  it('true on the site root for a cross-apex site — the header must reflect the login', () => {
    stubLocation('https://cookbook.com', '/')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('true on the site root when the hint cookie says a session exists', () => {
    setHint(true)
    stubLocation('https://cookbook.com', '/')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('true on a root path written with a trailing slash, and on the empty pathname', () => {
    // Static exports serve the deck as `/` or ``. The rule no longer turns on the
    // route at all, so neither spelling can produce a different answer.
    setHint(true)
    stubLocation('https://cookbook.com', '')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('true on /tour — the second half of the generated deck', () => {
    setHint(true)
    stubLocation('https://cookbook.com', '/tour')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('true on the public legal pages and on app routes alike', () => {
    setHint(true)
    stubLocation('https://cookbook.com', '/privacy')
    expect(shouldSilentRestore('')).toBe(true)
    stubLocation('https://cookbook.com', '/home')
    expect(shouldSilentRestore('')).toBe(true)
  })
})

describe('preflightSsoReturn', () => {
  const args = { clientId: 'adh', returnUrl: 'https://cookbook.com/' }

  it('asks the AS ITSELF — the same host the probe would navigate to', async () => {
    // The allow-list being asked about lives in the ANSWERING server's client row, and
    // the AS host and this site's /api backend are not always the same server: in the
    // dev.local suite the proxy reaches this worktree's backend while the AS is the
    // shared auth service with its own database. Asking the proxy would have one server
    // speak for another's allow-list, and a wrong `false` here is indistinguishable
    // from the bug the preflight exists to fix.
    const fetchImpl = preflightFetch(true)
    await preflightSsoReturn({ ...args, fetchImpl })
    const [url, init] = preflightCall(fetchImpl)
    const parsed = new URL(url, 'https://cookbook.com')
    expect(parsed.origin).toBe('https://api.example.com')
    expect(parsed.pathname).toBe('/oauth/signin/preflight')
    expect(parsed.searchParams.get('clientId')).toBe('adh')
    expect(parsed.searchParams.get('return')).toBe('https://cookbook.com/')
    // Cross-origin, so `omit` is not tidiness: the backend answers this route with
    // `Access-Control-Allow-Origin: *`, which browsers refuse to honour for a
    // credentialed request. It is also what makes `*` safe to send.
    expect(init.credentials).toBe('omit')
  })

  // The one case that still goes through the proxy, and it is the case where
  // /authorize goes through it too (asEndpoint makes both choices in one place), so
  // the same-server property holds here as well.
  it('falls back to the same-origin /api proxy when no AS base is configured', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_API_URL
    const fetchImpl = preflightFetch(true)
    await preflightSsoReturn({ ...args, fetchImpl })
    const [url] = preflightCall(fetchImpl)
    const parsed = new URL(url, 'https://cookbook.com')
    expect(parsed.origin).toBe('https://cookbook.com')
    expect(parsed.pathname).toBe('/api/oauth/signin/preflight')
  })

  it('asks the base it was PASSED, not only the env one', async () => {
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://env.example.com'
    const fetchImpl = preflightFetch(true)
    await preflightSsoReturn({ ...args, authApiBase: 'https://explicit.example.com', fetchImpl })
    const [url] = preflightCall(fetchImpl)
    expect(new URL(url).origin).toBe('https://explicit.example.com')
  })

  it('true only on an explicit allowed:true', async () => {
    expect(await preflightSsoReturn({ ...args, fetchImpl: preflightFetch(true) })).toBe(true)
    expect(await preflightSsoReturn({ ...args, fetchImpl: preflightFetch(false) })).toBe(false)
  })

  // Every one of these means "don't navigate". Failing closed costs an avatar;
  // failing open costs the visitor the page they asked for.
  it('false on a non-200', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    expect(await preflightSsoReturn({ ...args, fetchImpl })).toBe(false)
  })

  it('false when the request throws (AS down, proxy dead-end, offline)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await preflightSsoReturn({ ...args, fetchImpl })).toBe(false)
  })

  // A hung request is NOT the same failure as a refused one, which is why the two
  // cases below exist alongside the throwing one. The AuthProvider awaits this call
  // before it clears `isLoading`, so "never answers" is not a slow avatar — it is a
  // header stuck in its loading state for the life of the page, on every site, with
  // no Login button to click. `fetch` has no timeout of its own and a wedged TCP
  // connection does not fail fast, so the bound has to be passed in.
  it('passes an abort signal, so a wedged AS cannot answer never', async () => {
    const fetchImpl = preflightFetch(true)
    await preflightSsoReturn({ ...args, fetchImpl })
    const [, init] = preflightCall(fetchImpl)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    // Not already aborted: a signal that starts aborted would refuse every preflight
    // and look exactly like a correctly-configured refusal.
    expect(init.signal?.aborted).toBe(false)
  })

  // Real time, deliberately: `AbortSignal.timeout` is implemented inside the runtime
  // and does not go through the `setTimeout` vi.useFakeTimers replaces, so a faked
  // clock would hang here rather than prove anything. The wait is the timeout itself.
  it('resolves false when the AS never answers at all', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    ) as unknown as typeof fetch
    await expect(preflightSsoReturn({ ...args, fetchImpl })).resolves.toBe(false)
  }, 10_000)

  it('false on a body of the wrong shape', async () => {
    // A misrouted proxy that answers 200 with someone else's JSON (or HTML) must not
    // read as permission.
    const bodies = ['{"allowed":"yes"}', '{}', 'not json at all']
    for (const body of bodies) {
      const fetchImpl = vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch
      expect(await preflightSsoReturn({ ...args, fetchImpl })).toBe(false)
    }
  })
})

describe('beginSilentLogin', () => {
  it('navigates to the AS /authorize with prompt=none, returning to the CURRENT page', async () => {
    // The silent result bounces back to the page the user is on (not the dedicated
    // callback), so its own AuthProvider exchanges the #code in place.
    const loc = stubLocation('https://status.example.com', '/incidents', '?team=core')

    expect(await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(true) })).toBe(true)

    const url = new URL(loc.href)
    expect(url.origin + url.pathname).toBe('https://api.example.com/oauth/signin/authorize')
    expect(url.searchParams.get('clientId')).toBe('adh')
    expect(url.searchParams.get('prompt')).toBe('none')
    expect(url.searchParams.get('return')).toBe('https://status.example.com/incidents?team=core')
  })

  it('asks the SAME host it then navigates to', async () => {
    // The pairing that makes the answer usable. The allow-list lives in the answering
    // server's client row, so a preflight aimed anywhere other than the host about to
    // receive the probe is one server speaking for another's configuration.
    const loc = stubLocation('https://status.example.com', '/')
    const fetchImpl = preflightFetch(true)

    await beginSilentLogin({ clientId: 'adh', authApiBase: 'https://as.example.com', fetchImpl })

    const [asked] = preflightCall(fetchImpl)
    expect(new URL(asked as string).origin).toBe(new URL(loc.href).origin)
    expect(new URL(loc.href).origin).toBe('https://as.example.com')
  })

  it('navigates NOWHERE when the preflight refuses', async () => {
    // The stranding case, and the only reason landing routes ever had to refuse:
    // this origin is not on the client's return-origin allow-list yet (a site
    // registered since the last backend deploy), so /authorize would send the
    // browser to the central login page. Staying put leaves the page anonymous,
    // exactly where it would have been had it never asked.
    const loc = stubLocation('https://newly-registered.com', '/')

    expect(await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(false) })).toBe(false)

    expect(loc.href).toBe('')
  })

  it('spends the tab check even when the preflight refuses', async () => {
    // A "no" is a fact about this origin's configuration, not a transient one: it
    // will not change while the tab is open, so re-asking on every route change
    // would be pure cost.
    stubLocation('https://newly-registered.com', '/')

    await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(false) })

    expect(shouldSilentRestore('')).toBe(false)
  })

  it('probes from a LOCAL host when the preflight allows it', async () => {
    // Locality used to veto the probe outright, as a stand-in for "this origin
    // probably isn't allow-listed". The preflight answers that exactly, so a
    // dev.local suite origin — which IS allow-listed off production — now restores
    // a session like a deployed site, and a bare `next dev` on localhost:3000,
    // which is not, is refused by the next test rather than by a guess.
    const loc = stubLocation('https://orgs.hub-mybranch.dev.local', '/')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.example.com'

    expect(await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(true) })).toBe(true)
    expect(loc.href).toContain('/oauth/signin/authorize')
  })

  it('does not navigate from a local host the AS will not return to', async () => {
    const loc = stubLocation('http://localhost:3000', '/')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.example.com'

    expect(await beginSilentLogin({ clientId: 'adh', fetchImpl: preflightFetch(false) })).toBe(false)
    expect(loc.href).toBe('')
  })
})
