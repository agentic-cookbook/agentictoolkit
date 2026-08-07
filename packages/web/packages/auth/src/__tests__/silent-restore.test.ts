import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { shouldSilentRestore, ssoHintPresent, beginSilentLogin, clearSsoChecked } from '../sso'

// Guards for the cold-load silent SSO restore. The gating is safety-critical:
// the AuthProvider runs on every brand site, so a wrong "yes" would redirect
// anonymous/public visitors. It must say "yes" ONLY when the hint cookie is
// present, we're not mid-flow on the callback, and we haven't checked this tab.

let savedLocation: PropertyDescriptor | undefined
function stubLocation(
  origin: string,
  pathname = '/dashboard',
  search = '',
): { href: string } {
  // hostname is derived from the origin, not passed separately, so a test can't
  // stub a host that contradicts its own origin — the locality rule below reads it.
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

beforeEach(() => {
  window.sessionStorage.clear()
  setHint(false)
  delete process.env.NEXT_PUBLIC_AUTH_API_URL
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
  it('true only with a hint, no mid-flow fragment, and not yet checked', () => {
    setHint(true)
    // An ordinary in-app route: every case below is about the hint / apex / tab
    // rules, so none of them may sit on the landing page, where the answer is
    // always no (see the landing-page block).
    stubLocation('https://status.example.com')
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('false without the hint on a same-apex site (anonymous — never redirect)', () => {
    // No AS host configured ⇒ not cross-apex ⇒ hint-gated ⇒ no probe.
    stubLocation('https://status.example.com')
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('true for a DEPLOYED cross-apex site even without a readable hint (probe once)', () => {
    // A deployed brand site on its own apex; the AS is on another ⇒ cross-apex, so the
    // hint is unreadable and the one-per-tab blind probe is the only way to find the
    // session. Stubbed explicitly rather than relying on jsdom's `localhost`, which is
    // a LOCAL host and so takes the hint-gated branch below.
    const loc = stubLocation('https://cookbook.com')
    expect(loc).toBeTruthy()
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
    expect(shouldSilentRestore('')).toBe(true)
  })

  // The blind cross-apex probe is a top-level redirect to the AS made on nothing more
  // than a guess. It pays off only where every origin is on the AS's return-origin
  // allow-list (the deployed envs). A local host that ISN'T (a bare `next dev` on
  // localhost:3000) would be bounced to the central login page instead of back — the
  // historical "stranded on the hub login page" bug. So locally: hint or nothing.
  it('false on a LOCAL host with no readable hint (never blind-probe from local dev)', () => {
    const loc = stubLocation('http://localhost:3000')
    expect(loc).toBeTruthy()
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.dev.local'
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('true on a LOCAL dev.local suite host when the hint IS readable', () => {
    // The dev.local suite shares one registrable domain (`dev.local`) with its AS, so
    // the hint cookie IS readable here — a positive signal that a central session
    // exists. Restoring it is exactly as safe as in prod, and skipping it is why a
    // suite satellite used to show a logged-out header to a signed-in developer.
    setHint(true)
    const loc = stubLocation('https://projects.hub-mybranch.dev.local')
    expect(loc).toBeTruthy()
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://adh-backend.dev.local'
    expect(shouldSilentRestore('')).toBe(true)
  })

  it('false mid-flow on the callback (#code / #error present)', () => {
    setHint(true)
    stubLocation('https://status.example.com')
    expect(shouldSilentRestore('#code=abc')).toBe(false)
    expect(shouldSilentRestore('#error=login_required')).toBe(false)
  })

  it('false once the tab has already checked (loop guard)', () => {
    setHint(true)
    // beginSilentLogin marks the tab checked.
    stubLocation('https://status.example.com')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
    beginSilentLogin({ clientId: 'adh' })
    expect(shouldSilentRestore('')).toBe(false)
    clearSsoChecked()
    expect(shouldSilentRestore('')).toBe(true)
  })
})

// The landing page is the one route where the probe is never worth it, whatever
// the hint and apex rules say. It is a PUBLIC marketing deck the visitor asked
// for by name, and the probe is a top-level navigation OFF it: when the bounce
// can't complete — an origin the AS doesn't allow-list, an AS that isn't up yet —
// they are left looking at a login page (or an error page) having asked for a
// marketing page. An avatar in the header does not buy that risk. Nothing is
// lost: the probe still runs on the app routes behind the landing page, which is
// where a session actually changes what the visitor sees.
describe('shouldSilentRestore on a landing page', () => {
  it('false on the site root even when the hint cookie says a session exists', () => {
    setHint(true)
    stubLocation('https://cookbook.com', '/')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('false on the site root for a deployed cross-apex blind probe', () => {
    // The other half of the rule: cross-apex sites probe without a hint at all,
    // and that guess must not be made from the landing page either.
    stubLocation('https://cookbook.com', '/')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('false on a root path written with a trailing slash', () => {
    // Static hosts serve the deck as `/` or `` depending on the export; the rule
    // is about the ROUTE, so it can't turn on which spelling arrived.
    setHint(true)
    stubLocation('https://cookbook.com', '')
    expect(shouldSilentRestore('')).toBe(false)
  })

  it('true one route in — the probe moves to the app surfaces, it is not lost', () => {
    setHint(true)
    stubLocation('https://cookbook.com', '/home')
    expect(shouldSilentRestore('')).toBe(true)
  })
})

describe('beginSilentLogin', () => {
  it('navigates to the AS /authorize with prompt=none, returning to the CURRENT page', () => {
    setHint(true)
    // The silent result bounces back to the page the user is on (not the
    // dedicated callback), so its own AuthProvider exchanges the #code in place.
    const loc = stubLocation('https://status.example.com', '/incidents', '?team=core')
    process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'

    beginSilentLogin({ clientId: 'adh' })

    const url = new URL(loc.href)
    expect(url.origin + url.pathname).toBe('https://api.example.com/oauth/signin/authorize')
    expect(url.searchParams.get('clientId')).toBe('adh')
    expect(url.searchParams.get('prompt')).toBe('none')
    expect(url.searchParams.get('return')).toBe('https://status.example.com/incidents?team=core')
  })
})
