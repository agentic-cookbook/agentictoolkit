import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdhFooter } from '../AdhFooter'
import { buildVersionLabel } from '../SiteFooter'

// Stub next/link so the (otherwise DOM-invisible) `prefetch` prop can be observed —
// the real component destructures `prefetch` before spreading the rest onto the
// anchor (next/dist/client/link.js), so it never reaches the DOM on its own. The
// stub forwards everything else (href, onClick, className, children) unchanged so
// every other assertion in this file still exercises real link behavior.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, ...rest }: { href: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest} />
  ),
}))

describe('AdhFooter (identity-free)', () => {
  it('renders the copyright it is given, with no hardcoded brand', () => {
    render(<AdhFooter copyright={<span>© 2026 Example Co</span>} />)
    expect(screen.getByText('© 2026 Example Co')).toBeTruthy()
  })

  it('renders trailing as the last child of <footer>, a sibling of the container — not nested inside it', () => {
    render(<AdhFooter trailing={<span>chat</span>} />)
    const footer = screen.getByRole('contentinfo')
    const trailing = screen.getByText('chat')
    // Node identity, not a substring match: if `trailing` were moved inside
    // .adh-footer__container, footer.lastElementChild would be the container div
    // (whose textContent would still happen to include "chat"), not the trailing
    // node itself — a toHaveTextContent check alone would not catch that.
    expect(footer.lastElementChild).toBe(trailing)
  })

  it('renders a native popover trigger for popoverTarget entries', () => {
    render(<AdhFooter links={[{ label: 'Sites', popoverTarget: 'panel-1', ariaLabel: 'Sites — overview' }]} />)
    const btn = screen.getByRole('button', { name: 'Sites — overview' })
    expect(btn.getAttribute('popovertarget')).toBe('panel-1')
    expect(btn.className).toContain('adh-footer__sites-trigger')
  })

  it('keeps the href on onSelect entries so they still work without JS', () => {
    let opened = false
    render(
      <AdhFooter
        links={[{ label: 'Terms', href: '/terms', onSelect: (e) => { e.preventDefault(); opened = true } }]}
      />,
    )
    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link.getAttribute('href')).toBe('/terms')
    link.click()
    expect(opened).toBe(true)
  })

  it('renders nothing brand-specific when given no props', () => {
    const { container } = render(<AdhFooter />)
    expect(container.textContent).not.toMatch(/FishLamp/)
  })

  it('renders no navigation links at all when unconfigured — there is no hard-coded default set', () => {
    render(<AdhFooter />)
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('passes prefetch through to the rendered anchor when given, and leaves it alone otherwise', () => {
    render(
      <AdhFooter
        links={[
          { label: 'Terms', href: '/terms', prefetch: false },
          { label: 'GitHub', href: 'https://example.com' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('data-prefetch')).toBe('false')
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('data-prefetch')).toBe('undefined')
  })

  it('renders the version as the last child INSIDE the container, not as a sibling of it', () => {
    render(<AdhFooter copyright={<span>© 2026</span>} version="v1.0.155 · a73e79b7" />)
    const footer = screen.getByRole('contentinfo')
    const container = footer.firstElementChild!
    // Node identity, not textContent: `trailing` renders OUTSIDE the container
    // and is bitbag's portal mount, so a version routed there would be text-present
    // but visually absent from the footer bar. This is the assertion that catches it.
    expect(container.lastElementChild!.textContent).toBe('v1.0.155 · a73e79b7')
    expect(container.lastElementChild!.className).toBe('adh-footer__version')
  })

  it('renders the version after the links nav, not before it', () => {
    render(
      <AdhFooter
        links={[{ label: 'Terms', href: '/terms' }]}
        version="v1.0.155"
      />,
    )
    const container = screen.getByRole('contentinfo').firstElementChild!
    const kids = Array.from(container.children).map((el) => el.className)
    expect(kids.indexOf('adh-footer__version')).toBeGreaterThan(kids.indexOf('adh-footer__links'))
  })

  it('renders no version element at all when none is passed', () => {
    const { container } = render(<AdhFooter copyright={<span>© 2026</span>} />)
    expect(container.querySelector('.adh-footer__version')).toBeNull()
  })

  it('keeps the version inside the container even when trailing is present', () => {
    render(<AdhFooter version="v1.0.155" trailing={<span>chat</span>} />)
    const footer = screen.getByRole('contentinfo')
    // trailing stays the footer's last child (the existing contract); the version
    // is inside the container, so the two never compete for the same slot.
    expect(footer.lastElementChild!.textContent).toBe('chat')
    expect(footer.firstElementChild!.querySelector('.adh-footer__version')).not.toBeNull()
  })
})

describe('SiteFooter (build constants → version)', () => {
  it('joins the version and the short SHA with a middot, and titles it with the full SHA', () => {
    // Next inlines NEXT_PUBLIC_* at build time; in vitest they are ordinary env
    // reads, which is exactly what makes this composition testable here.
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.155')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', 'a73e79b7c0ffee00deadbeef1234567890abcdef')
    const el = buildVersionLabel()
    expect(el).not.toBeNull()
    render(<div>{el}</div>)
    expect(screen.getByText('v1.0.155 · a73e79b7')).toBeTruthy()
    expect(screen.getByTitle('a73e79b7c0ffee00deadbeef1234567890abcdef')).toBeTruthy()
    vi.unstubAllEnvs()
  })

  it('shows the SHA alone when the site has no VERSION file', () => {
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', 'a73e79b7c0ffee00deadbeef1234567890abcdef')
    render(<div>{buildVersionLabel()}</div>)
    expect(screen.getByText('a73e79b7')).toBeTruthy()
    vi.unstubAllEnvs()
  })

  it('shows the version alone, with no trailing middot, when every SHA source failed', () => {
    // Reachable outside Vercel/Railway when the build also isn't a git checkout:
    // VERCEL_GIT_COMMIT_SHA -> RAILWAY_GIT_COMMIT_SHA -> git rev-parse HEAD -> "" all miss.
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.155')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '')
    render(<div>{buildVersionLabel()}</div>)
    expect(screen.getByText('v1.0.155')).toBeTruthy()
    vi.unstubAllEnvs()
  })

  it('renders nothing at all when neither constant is set', () => {
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '')
    expect(buildVersionLabel()).toBeNull()
    vi.unstubAllEnvs()
  })
})
