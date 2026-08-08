import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// The equivalence test for Task 5.6's split. `AdhHeader` (now
// `@agentic-toolkit/adh/header`) resolves NOTHING about adh — it takes a site name,
// a switcher and a pre-auth slot as props. Everything that reads the adh site
// registry stayed on this side, in `SiteHeader`. So what needs pinning is not the
// bar's markup (the toolkit's own header-contract.test.tsx covers that) but that the
// registry half still does its jobs and hands the generic half the right values.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

// What crossed the boundary, captured on the way out. Wrapping (rather than
// replacing) the toolkit header means the assertions below still run against the
// real bar — this only tees off the props.
const headerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@agentic-toolkit/adh/header', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agentic-toolkit/adh/header')>()
  return {
    ...actual,
    AdhHeader: (props: Record<string, unknown>) => {
      headerProps.current = props
      return <actual.AdhHeader {...(props as Parameters<typeof actual.AdhHeader>[0])} />
    },
  }
})

// adh's real switcher stands in as a probe, because its contents are already covered by
// header/__tests__/{useSiteMenu,debugSiteGroups,fleetMenuGroups}.test — re-rendering the
// whole menu here would test those twice and this file's subject not at all.
//
// That is now the WHOLE reason. While this file lived in the former `@adh/chrome` it carried a
// second one: the switcher is Base-UI-backed, and @base-ui/utils resolved from the
// toolkit workspace's own store, dragging a second React copy in ("Invalid hook call").
// Inside the toolkit there is one workspace and one react, so that constraint is gone —
// the stub is a scoping choice here, not a workaround.
const switcherProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('../header/SiteMenuSwitcher', () => ({
  SiteMenuSwitcher: (props: Record<string, unknown>) => {
    switcherProps.current = props
    return <div data-testid="adh-site-switcher" />
  },
}))

// The avatar menu, stubbed to keep this file's subject in view: `AvatarMenu` is the only
// thing the header renders when `user != null`, and a signed-in render is exactly what
// the auth source's assertions below need — its whole job is producing `user`. Stubbing
// it means those assertions read the source's output rather than Base UI's markup.
//
// Mocked at its own module path rather than through the `@agentic-toolkit/adh/header`
// barrel above: `AdhHeader.tsx` imports `./AvatarMenu` relatively, so a barrel mock never
// reaches it. A sibling relative path now, not the long `external/agentictoolkit/.../src/`
// form this file carried in the former `@adh/chrome` — that spelling existed only to name a
// file on
// the far side of a workspace boundary, and had to end at `src/` because vitest resolves
// the package's `development` export condition there. Same file either way; this one
// survives the package being consumed standalone.
vi.mock('../header/AvatarMenu', () => ({
  AvatarMenu: (props: { user: { name: string } }) => (
    <div data-testid="adh-avatar-menu">{props.user.name}</div>
  ),
}))

import { SiteHeader } from '../header/SiteHeader'
import { getSite, siteHeaderTitle } from '@agentic-toolkit/adh-registry'
import type { HeaderAuthSourceOptions, HeaderAuthState } from '@agentic-toolkit/adh/header-auth'

describe('SiteHeader', () => {
  it('resolves the brand from the registry rather than taking it as a prop', () => {
    render(<SiteHeader siteId="products" />)
    // Registry-derived, not the raw id: `getSite` + `siteHeaderTitle`, both chrome's
    // to call. adh always fills the switcher slot, so this value reaches no rendered
    // node today — which is exactly why it needs pinning at the boundary instead.
    expect(headerProps.current?.siteName).toBe(siteHeaderTitle(getSite('products')!))
  })

  it("fills the toolkit header's switcher slot with adh's own registry-bound menu", () => {
    render(<SiteHeader siteId="products" />)
    expect(headerProps.current?.siteSwitcher).toBeTruthy()
    expect(screen.getByTestId('adh-site-switcher')).toBeTruthy()
    // Never both, and this has to be asserted against what the default switcher
    // ACTUALLY renders here. An earlier version looked for the popover trigger's
    // `<siteName> — switch site` label, which cannot fail: `SiteHeader` never passes
    // `sites`, so the default renders its no-targets form — a plain
    // `.adh-header__title` link — and that label is absent whether the slot works or
    // not. The lead slot holding the probe and nothing title-shaped is the real pin:
    // drop `siteSwitcher` from SiteHeader and this line goes red.
    const lead = screen.getByRole('banner').querySelector('.adh-header__lead')!
    expect(lead.querySelector('.adh-header__title')).toBeNull()
    expect(lead.firstElementChild).toBe(screen.getByTestId('adh-site-switcher'))
    // The switcher gets the current site and the registry-resolved settings target.
    expect(switcherProps.current?.currentSiteId).toBe('products')
    expect(switcherProps.current?.settingsHref).toContain('/home/settings')
  })

  it('adds the "Details" link on a concept site and omits it elsewhere', () => {
    // `isConceptSite` and the `/details` path are adh vocabulary and stayed here; the
    // toolkit only knows it was handed some nodes for its `preAuthLinks` slot.
    const { unmount } = render(<SiteHeader siteId="products" />)
    expect(screen.getByRole('link', { name: 'Details' }).getAttribute('href')).toBe('/details')
    unmount()

    render(<SiteHeader siteId="hub" />)
    expect(screen.queryByRole('link', { name: 'Details' })).toBeNull()
  })

  it('sends signed-out auth to the hub with a return_to back to this site', () => {
    render(<SiteHeader siteId="products" />)
    // Resolved HERE (siteUrl/siteProdUrl + siteHomePath) and handed over as plain
    // strings, so the toolkit never learns what a site id is.
    for (const [name, path] of [
      ['login', '/login'],
      ['join', '/signup'],
    ] as const) {
      const href = screen.getByRole('link', { name }).getAttribute('href') ?? ''
      expect(href).toContain(path)
      expect(href).toContain('return_to=')
    }
  })

  it('lets a site override the auth hrefs the registry would otherwise supply', () => {
    render(<SiteHeader siteId="products" loginHref="/login" signupHref="/signup" />)
    expect(screen.getByRole('link', { name: 'login' }).getAttribute('href')).toBe('/login')
    expect(screen.getByRole('link', { name: 'join' }).getAttribute('href')).toBe('/signup')
  })
})

// Task 6.2: the pluggable auth source, folded in from the retired @adh-shared auth shim's SiteHeader
// (which wrapped this one purely to inject it). One component now, so a site cannot get
// the registry half without the auth half or vice versa.
describe('SiteHeader auth source injection', () => {
  it('invokes the injected source and forwards its auth state to the header', () => {
    const onAfterLogout = vi.fn()
    const useFakeSource = vi.fn(
      (_opts: HeaderAuthSourceOptions): HeaderAuthState => ({
        // Name only — AvatarMenuUser carries no email, so a source cannot hand one
        // across and no header surface can print one.
        user: { name: 'Ada' },
        userIsAdmin: true,
        onLogin: () => {},
        onLogout: () => {},
      }),
    )
    render(
      <SiteHeader
        siteId="hub"
        clientId="demo"
        onAfterLogout={onAfterLogout}
        useAuthSource={useFakeSource}
      />,
    )
    // Invoked AS a hook — unconditionally, on EVERY render, with the per-site options
    // forwarded. `siteId` rides along with the two auth props: a session-aware source
    // resolves THIS site's post-login landing from it (see makeSmartHeaderAuth's
    // defaultReturnTo), and one source instance is shared across a whole site family,
    // so it cannot be closed over at construction. Deliberately not pinned to a single
    // call: `useClientHost` resolves the hostname in a mount effect, so the header
    // renders twice here, and a source that ran only on the first render would be the
    // bug rather than the contract.
    expect(useFakeSource).toHaveBeenCalled()
    for (const [opts] of useFakeSource.mock.calls) {
      expect(opts).toEqual({ clientId: 'demo', siteId: 'hub', onAfterLogout })
    }
    // ...and everything it returned crossed into the bar: `user` to the toolkit header,
    // `userIsAdmin` and the derived signed-in flag on to adh's own switcher. The menu
    // is stubbed above, so what is observable here is the value it was handed — the
    // stub prints the name — not the bar's printed copy, which is now the avatar
    // alone (pinned in the toolkit's own header-contract.test.tsx).
    expect(screen.getByTestId('adh-avatar-menu').textContent).toBe('Ada')
    expect(headerProps.current?.user).toEqual({ name: 'Ada' })
    expect(switcherProps.current?.authenticated).toBe(true)
    expect(switcherProps.current?.userIsAdmin).toBe(true)
  })

  it('resolves the function form of navLinks against the signed-in flag', () => {
    const useAnonymous = (): HeaderAuthState => ({ user: null })
    render(
      <SiteHeader
        siteId="hub"
        useAuthSource={useAnonymous}
        navLinks={(signedIn) =>
          signedIn ? [{ label: 'Workspace', href: '/w' }] : [{ label: 'Pricing', href: '/pricing' }]
        }
      />,
    )
    // Resolved AFTER the source ran, so a site varies its nav by auth state without
    // reading auth itself.
    expect(screen.getByText('Pricing')).toBeTruthy()
    expect(screen.queryByText('Workspace')).toBeNull()
  })

  it('defaults to the anonymous source, which never reads a session', () => {
    // The status board renders the family bar with NO adh AuthProvider above it, so a
    // default source that called `useAuth()` would crash the whole site.
    expect(() => render(<SiteHeader siteId="status" />)).not.toThrow()
  })
})
