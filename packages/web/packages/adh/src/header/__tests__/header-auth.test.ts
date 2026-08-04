// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { defaultReturnTo } from '../header-auth'

// The SHARED half of the Login/Sign-up contract (docs/platform/login-and-return.md §2):
// where a satellite's header Login / Sign up comes back to. Read at CLICK time, so it
// is a function of the page the visitor is standing on — never of where the source was
// built. Every session-aware satellite gets this, so no site has to patch it locally.

function at(path: string): void {
  window.history.pushState({}, '', path)
}

afterEach(() => at('/'))

describe('defaultReturnTo', () => {
  it("sends a login started on the landing to that site's own /home", () => {
    at('/')
    expect(defaultReturnTo('personaregistry')).toBe('/home')
  })

  it('brings a login started anywhere else back to that page', () => {
    at('/bob')
    expect(defaultReturnTo('personaregistry')).toBe('/bob')
  })

  it('keeps the query, so a deep link survives the SSO round-trip', () => {
    at('/bob?tab=chat')
    expect(defaultReturnTo('personaregistry')).toBe('/bob?tab=chat')
  })

  it('treats only the landing itself as the landing', () => {
    at('/bob/settings')
    expect(defaultReturnTo('personaregistry')).toBe('/bob/settings')
    at('/home')
    expect(defaultReturnTo('personaregistry')).toBe('/home')
  })

  // home-or-ROOT: a site with no gated landing has nowhere else to go, so its root
  // stays its root — the rule is one expression, not a /home special case.
  it("resolves to the site's ROOT when it declares no /home", () => {
    at('/')
    expect(defaultReturnTo('support')).toBe('/')
  })

  // A source built outside SiteHeader gets no siteId; guessing a landing there could
  // send a visitor to a route the site doesn't have.
  it('degrades to the current path when the site is unknown', () => {
    at('/')
    expect(defaultReturnTo()).toBe('/')
    at('/bob')
    expect(defaultReturnTo()).toBe('/bob')
  })
})
