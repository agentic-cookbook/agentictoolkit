// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { defaultReturnTo, toAvatarUser } from '../header-auth'

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

// `toAvatarUser` is the one place the family's "what do we call this account?"
// rule lives, and every header auth source goes through it. The rule has two
// outputs, not one: `name` (never empty — the trigger's accessible name and the
// initials source) and `fullName` (present only when a PERSON'S NAME is known,
// which is what makes the menu greet rather than label). The pair is what keeps a
// slug out of a greeting, so both are asserted on every case below.
describe('toAvatarUser', () => {
  it('takes the name as both the label and the greeting name', () => {
    expect(toAvatarUser({ email: 'mike@example.test', avatarUrl: '', name: 'Mike Fullerton' })).toEqual({
      name: 'Mike Fullerton',
      fullName: 'Mike Fullerton',
      imageUrl: undefined,
    })
  })

  it('labels with the handle, and greets nobody, when there is no name', () => {
    // Hub's shape for a user whose profile carries a slug but no name. `fullName`
    // being absent is the assertion that matters: it is the only thing standing
    // between the menu and "Welcome mikefullerton!".
    const u = toAvatarUser({ email: 'mike@example.test', avatarUrl: '', label: 'mikefullerton' })
    expect(u.name).toBe('mikefullerton')
    expect(u.fullName).toBeUndefined()
  })

  it('prefers the name over the handle when it has both', () => {
    const u = toAvatarUser({
      email: 'mike@example.test',
      avatarUrl: '',
      name: 'Mike Fullerton',
      label: 'mikefullerton',
    })
    expect(u.name).toBe('Mike Fullerton')
    expect(u.fullName).toBe('Mike Fullerton')
  })

  it('falls back to the email local-part, which is a label and never a name', () => {
    // A local-part is a string that happens to look name-ish; it is not one, so it
    // must not be greeted. It also stops the FULL address reaching the avatar shape
    // at all — no header surface can print what it was never handed.
    const u = toAvatarUser({ email: 'mike@example.test', avatarUrl: '' })
    expect(u.name).toBe('mike')
    expect(u.fullName).toBeUndefined()
    expect(JSON.stringify(u)).not.toContain('example.test')
  })

  it('falls back last to the caller-supplied word — admin passes "Admin"', () => {
    const u = toAvatarUser({ email: '', avatarUrl: '' }, 'Admin')
    expect(u.name).toBe('Admin')
    expect(u.fullName).toBeUndefined()
  })

  it('treats a whitespace-only name as no name at all', () => {
    // A backend that stores '' or ' ' for a nameless OAuth account would otherwise
    // produce an empty greeting and empty initials — `name` is never-empty by
    // contract, and this is where that is enforced.
    const u = toAvatarUser({ email: 'mike@example.test', avatarUrl: '', name: '  ' })
    expect(u.name).toBe('mike')
    expect(u.fullName).toBeUndefined()
  })

  it('drops an empty avatar url rather than passing it through', () => {
    // `<AvatarImage src="">` renders a broken image where the initials should be.
    expect(toAvatarUser({ email: 'mike@example.test', avatarUrl: '' }).imageUrl).toBeUndefined()
    expect(
      toAvatarUser({ email: 'mike@example.test', avatarUrl: 'https://img.test/a.png' }).imageUrl,
    ).toBe('https://img.test/a.png')
  })
})
