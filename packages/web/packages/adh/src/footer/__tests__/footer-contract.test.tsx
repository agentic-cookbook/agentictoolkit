import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('renders the version INSIDE the container, not as a sibling of it', () => {
    render(<AdhFooter copyright={<span>© 2026</span>} version="v1.0.155 · a73e79b7" />)
    const footer = screen.getByRole('contentinfo')
    const container = footer.firstElementChild!
    // Containment, not textContent: `trailing` renders OUTSIDE the container
    // and is bitbag's portal mount, so a version routed there would be text-present
    // but visually absent from the footer bar. This is the assertion that catches it.
    // Asserted by containment rather than by position, so it survives a reorder
    // within the bar — where the version sits among its siblings is the next test's
    // contract, and only that one should fail when the order changes.
    const version = container.querySelector('.adh-footer__version')!
    expect(version).not.toBeNull()
    expect(version.textContent).toBe('v1.0.155 · a73e79b7')
    expect(version.parentElement).toBe(container)
  })

  it('renders the version BEFORE the links nav, so Sites/Terms/Privacy sit at the trailing edge', () => {
    render(
      <AdhFooter
        links={[{ label: 'Terms', href: '/terms' }]}
        version="v1.0.155"
      />,
    )
    const container = screen.getByRole('contentinfo').firstElementChild!
    const kids = Array.from(container.children).map((el) => el.className)
    expect(kids.indexOf('adh-footer__version')).toBeLessThan(kids.indexOf('adh-footer__links'))
    // The links nav is the container's last child — the bar's trailing edge, since
    // `trailing` (bitbag) renders outside the container entirely.
    expect(container.lastElementChild!.className).toBe('adh-footer__links')
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
  // In `afterEach`, not at the end of each body: a failing assertion aborts the body,
  // so an in-body unstub never runs on the one occasion it matters and leaves both
  // constants set for every test after it. That turns one real failure into a cascade
  // of misattributed ones — and the last case here ("neither constant is set") would
  // only pass because its own stubs happened to overwrite the leak.
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
  })

  it('shows the SHA alone when the site has no VERSION file', () => {
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', 'a73e79b7c0ffee00deadbeef1234567890abcdef')
    render(<div>{buildVersionLabel()}</div>)
    expect(screen.getByText('a73e79b7')).toBeTruthy()
  })

  it('shows the version alone, with no trailing middot, when every SHA source failed', () => {
    // Reachable outside Vercel/Railway when the build also isn't a git checkout:
    // VERCEL_GIT_COMMIT_SHA -> RAILWAY_GIT_COMMIT_SHA -> git rev-parse HEAD -> "" all miss.
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.155')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '')
    render(<div>{buildVersionLabel()}</div>)
    expect(screen.getByText('v1.0.155')).toBeTruthy()
  })

  it('renders nothing at all when neither constant is set', () => {
    vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '')
    vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '')
    expect(buildVersionLabel()).toBeNull()
  })

  // The dev-mode override. The constants above are baked when Next evaluates
  // `next.config.ts` — once, at dev-server boot — so across a long session the footer
  // kept reporting the commit the session started on and a bumped VERSION moved
  // nothing. AppShell (a Server Component) resolves the real pair per render and
  // passes it here; see `liveBuildIdentity` and its own tests.
  describe('the live override', () => {
    it('wins over both baked constants', () => {
      vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.0')
      vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '618f848dfeedfacecafebabe1234567890abcdef')
      render(<div>{buildVersionLabel({ version: '1.1.0', sha: 'a73e79b7c0ffee00deadbeef1234567890abcdef' })}</div>)
      expect(screen.getByText('v1.1.0 · a73e79b7')).toBeTruthy()
      // The title carries the LIVE full sha too — copying it has to yield a commit that
      // exists in the tree you are looking at, which is the field's only job.
      expect(screen.getByTitle('a73e79b7c0ffee00deadbeef1234567890abcdef')).toBeTruthy()
    })

    it('falls back per field, so a value it could not read leaves the baked one standing', () => {
      // This is what makes the override safe to apply unconditionally: it can only ever
      // CORRECT a field, never blank one. A site with no VERSION file, or a dev server
      // outside a git checkout, keeps whatever the config managed to bake.
      vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.0')
      vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', '618f848dfeedfacecafebabe1234567890abcdef')
      render(<div>{buildVersionLabel({ version: undefined, sha: 'a73e79b7c0ffee00deadbeef1234567890abcdef' })}</div>)
      expect(screen.getByText('v1.0.0 · a73e79b7')).toBeTruthy()
    })

    it('changes nothing when it is absent — the production path is untouched', () => {
      vi.stubEnv('NEXT_PUBLIC_ADH_SITE_VERSION', '1.0.155')
      vi.stubEnv('NEXT_PUBLIC_ADH_RELEASE', 'a73e79b7c0ffee00deadbeef1234567890abcdef')
      render(<div>{buildVersionLabel(undefined)}</div>)
      expect(screen.getByText('v1.0.155 · a73e79b7')).toBeTruthy()
    })
  })
})
