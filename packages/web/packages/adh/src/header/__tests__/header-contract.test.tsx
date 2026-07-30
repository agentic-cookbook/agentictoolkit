/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdhHeader, DEV_PREVIEW_BADGES } from '../AdhHeader'

// The dropdown behind the switcher is base-ui backed: its portal returns null while
// closed (keepMounted defaults false), so a closed menu's rows are absent from the DOM
// entirely. Every assertion about menu CONTENT below therefore opens the menu first —
// a cold getByText would either fail, or (worse) pass off the trigger's own label.
const openSwitcher = async (siteName: string): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: `${siteName} — switch site` }))
  await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())
}

describe('AdhHeader (registry-free)', () => {
  // ── brief test 1, unchanged ──
  it('renders the site name it was given, with no registry lookup', () => {
    render(<AdhHeader siteName="Agentic Developer Hub" siteNameHref="/" />)
    expect(screen.getByText('Agentic Developer Hub')).toBeTruthy()
  })

  // ── brief test 2, rewritten: SiteLink is { id?, label, href, description? }, and the
  //    menu must be OPENED before its rows exist (see openSwitcher above). ──
  it('renders caller-supplied sites in the switcher, with or without an id', async () => {
    render(
      <AdhHeader
        siteName="Hub"
        sites={[
          { id: 'fishlamp', label: 'FishLamp', href: 'https://example.test' },
          //  `id` is OPTIONAL on the published SiteLink. A target without one must
          //  still render and still key stably (SiteSwitcher falls back to the href);
          //  requiring it would have broken every existing SiteOptionsMenu caller.
          { label: 'Lampfish', href: 'https://other.test' },
        ]}
      />,
    )
    // Cold, the sites are genuinely not in the DOM — that is the portal, not a bug.
    expect(screen.queryByText('FishLamp')).toBeNull()
    await openSwitcher('Hub')
    expect(screen.getByText('FishLamp')).toBeTruthy()
    expect(screen.getByText('Lampfish')).toBeTruthy()
  })

  //  The id-less fallback (`key: site.id ?? site.href`) is contract, not detail — but
  //  it is invisible in the DOM: NavigationPopover consumes `item.key` only as a React
  //  key and renders it nowhere. Its one observable surface is the argument handed to
  //  `onSwitchSite`, so that is what this pins. Without the fallback a later `site.id!`
  //  sends `undefined` to a consumer's SSO rewriter, which silently declines to rewrite
  //  and lets the switcher navigate to a raw href while signed out.
  it('hands onSwitchSite the href of a target that has no id', async () => {
    //  Returning a hash keeps jsdom to a same-document navigation; window.location
    //  .assign to a real origin raises "Not implemented: navigation" instead.
    const onSwitchSite = vi.fn(() => '#switched')
    render(
      <AdhHeader
        siteName="Hub"
        sites={[{ label: 'Lampfish', href: 'https://other.test' }]}
        onSwitchSite={onSwitchSite}
      />,
    )
    await openSwitcher('Hub')
    fireEvent.click(screen.getByText('Lampfish'))
    expect(onSwitchSite).toHaveBeenCalledWith('https://other.test')
  })

  // ── brief test 3, rewritten: `badges` is HeaderBadge[], not a ReactNode. The brief's
  //    own normative rule says so; only its sample test disagreed. ──
  it('renders the badges, center and leadingActions slots ported from the adh header', () => {
    render(
      <AdhHeader
        siteName="Hub"
        badges={[{ label: 'badge' }]}
        center={<span>center</span>}
        leadingActions={<span>leading</span>}
      />,
    )
    for (const text of ['badge', 'center', 'leading']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  // Dropping the default would silently remove a visible badge from every adh site, so
  // the default is part of the contract, not an implementation detail.
  it('defaults badges to the shipped preview badge, and honours an explicit empty list', () => {
    const { rerender } = render(<AdhHeader siteName="Hub" />)
    expect(screen.getByText(DEV_PREVIEW_BADGES[0]!.label)).toBeTruthy()
    rerender(<AdhHeader siteName="Hub" badges={[]} />)
    expect(screen.queryByText(DEV_PREVIEW_BADGES[0]!.label)).toBeNull()
  })

  // ── brief test 4, rewritten. There is no `routes`/`adminOnly` prop here and there
  //    must not be one: the admin-gated route map is adh registry vocabulary. The intent
  //    the brief was pinning — admin-only navigation never appears in a header that was
  //    not given one — is pinned at its real seam: this header renders no admin surface
  //    of its own, and `userIsAdmin` reaches only a slot-supplied switcher. (`userIsAdmin`
  //    stays on AdhHeaderAuthProps because shared/auth's HeaderAuthState is derived from
  //    that type and must keep its shape.) ──
  it('exposes no admin surface of its own — userIsAdmin only reaches a caller-supplied switcher', () => {
    const { rerender } = render(<AdhHeader siteName="Hub" />)
    expect(screen.queryByText('Admin')).toBeNull()
    rerender(<AdhHeader siteName="Hub" userIsAdmin />)
    expect(screen.queryByText('Admin')).toBeNull()
    rerender(
      <AdhHeader siteName="Hub" userIsAdmin siteSwitcher={<button type="button">Admin</button>} />,
    )
    expect(screen.getByText('Admin')).toBeTruthy()
  })

  // ── brief test 5, rewritten: auth props are flat (there is no `auth` object and no
  //    `status` field — shared/auth's HeaderAuthState is derived FROM the flat type). ──
  it("defaults the signup label to adh's shipped copy", () => {
    render(<AdhHeader siteName="Hub" onLogin={() => {}} onSignup={() => {}} />)
    expect(screen.getByText('join')).toBeTruthy()
  })

  // ── beyond the brief: the two constraints attached to the siteSwitcher slot ──
  it('renders the caller-supplied switcher INSTEAD OF the default, never both', () => {
    render(
      <AdhHeader
        siteName="Hub"
        sites={[{ id: 'fishlamp', label: 'FishLamp', href: 'https://example.test' }]}
        siteSwitcher={<button type="button">Custom switcher</button>}
      />,
    )
    expect(screen.getByText('Custom switcher')).toBeTruthy()
    // The default switcher's trigger is gone entirely — not merely hidden, and not
    // sitting alongside. A slot that silently DOUBLES the switcher passes a naive
    // "is the custom one there?" check and shows up in a screenshot later.
    expect(screen.queryByRole('button', { name: 'Hub — switch site' })).toBeNull()
    // Exactly one node claims the lead slot, and it is the caller's.
    const lead = screen.getByRole('banner').querySelector('.adh-header__lead')!
    expect(lead.firstElementChild?.textContent).toBe('Custom switcher')
  })

  it('renders preAuthLinks after the nav links and before the auth cluster', () => {
    render(
      <AdhHeader
        siteName="Hub"
        navLinks={[{ label: 'Docs', href: '/docs' }]}
        // A deliberately GENERIC fixture. adh routes its concept-site link through
        // this slot, but hard-coding that link's path or label here would put adh
        // vocabulary in the toolkit's test tree — the exact coupling the slot exists
        // to prevent. Any placeholder proves the same positional contract.
        preAuthLinks={<a href="/slot-target">Slot link</a>}
        onLogin={() => {}}
        onSignup={() => {}}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const order = (el: Element): number => Array.prototype.indexOf.call(nav.children, el)
    const links = nav.querySelector('.adh-header__links')!
    const slotLink = screen.getByText('Slot link')
    const login = screen.getByText('login')
    // Position is behaviour: the slot is the last thing a signed-out visitor reads
    // before "login / join", and it must not be folded into the ordinary navLinks.
    expect(links.contains(slotLink)).toBe(false)
    expect(order(links)).toBeLessThan(order(slotLink))
    expect(order(slotLink)).toBeLessThan(order(login))
  })

  it('shows a spinner instead of the auth buttons while auth is still resolving', () => {
    render(<AdhHeader siteName="Hub" authLoading onLogin={() => {}} onSignup={() => {}} />)
    expect(screen.getByRole('status', { name: 'Checking sign-in' })).toBeTruthy()
    expect(screen.queryByText('join')).toBeNull()
  })
})
