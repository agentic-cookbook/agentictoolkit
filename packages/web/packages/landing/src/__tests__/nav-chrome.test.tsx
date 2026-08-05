import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { NavChrome } from '../chrome/NavChrome'

const LINKS = [
  { href: '#one', label: 'One' },
  { href: '#two', label: 'Two' },
]

describe('NavChrome', () => {
  it('renders the brand and one anchor per link', () => {
    const { container, getByText } = render(<NavChrome brand={<b>Mark</b>} links={LINKS} />)
    expect(getByText('Mark')).toBeTruthy()
    expect(container.querySelectorAll('.lp-drawer a.lp-nav')).toHaveLength(2)
  })

  it('starts closed, and a closed drawer is inert', () => {
    const { container } = render(<NavChrome brand="M" links={LINKS} />)
    const drawer = container.querySelector('.lp-drawer')!
    expect(drawer.className).not.toContain('lp-drawer--open')
    expect(drawer.hasAttribute('inert')).toBe(true)
  })

  it('opens on the burger and closes on a link', () => {
    const { container, getByLabelText, getByText } = render(
      <NavChrome brand="M" links={LINKS} />
    )
    fireEvent.click(getByLabelText('Open menu'))
    const drawer = container.querySelector('.lp-drawer')!
    expect(drawer.className).toContain('lp-drawer--open')
    expect(drawer.hasAttribute('inert')).toBe(false)
    fireEvent.click(getByText('One'))
    expect(container.querySelector('.lp-drawer')!.className).not.toContain('lp-drawer--open')
  })

  it('closes on Escape and on the scrim', () => {
    const { container, getByLabelText } = render(<NavChrome brand="M" links={LINKS} />)
    fireEvent.click(getByLabelText('Open menu'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('.lp-drawer')!.className).not.toContain('lp-drawer--open')

    fireEvent.click(getByLabelText('Open menu'))
    fireEvent.click(container.querySelector('.lp-scrim')!)
    expect(container.querySelector('.lp-drawer')!.className).not.toContain('lp-drawer--open')
  })

  it('moves focus into the drawer on open and back to the burger on close', () => {
    const { getByLabelText } = render(<NavChrome brand="M" links={LINKS} />)
    const burger = getByLabelText('Open menu')
    fireEvent.click(burger)
    expect(document.activeElement).toBe(getByLabelText('Close menu'))
    fireEvent.click(getByLabelText('Close menu'))
    expect(document.activeElement).toBe(burger)
  })

  it('does not steal focus on first render', () => {
    render(<NavChrome brand="M" links={LINKS} />)
    expect(document.activeElement).toBe(document.body)
  })

  it('renders the drawer footer when given one', () => {
    const { getByText } = render(
      <NavChrome brand="M" links={LINKS} footer={<a href="mailto:x@y.z">Mail</a>} />
    )
    expect(getByText('Mail')).toBeTruthy()
  })

  // An href is a URL, not a selector. Passing one straight to querySelector
  // threw a SyntaxError on exactly the off-page links the component's own
  // comment says a host may pass, so the click handler died mid-way.
  it('closes on an off-page link without throwing', () => {
    const offPage = [
      { href: 'mailto:hi@example.com', label: 'Mail' },
      { href: '/pricing.html', label: 'Pricing' },
      { href: 'https://example.com/x', label: 'Docs' },
      { href: '#', label: 'Top' },
    ]
    const { container, getByLabelText, getByText } = render(
      <NavChrome brand="M" links={offPage} />
    )
    for (const { label } of offPage) {
      fireEvent.click(getByLabelText('Open menu'))
      expect(() => fireEvent.click(getByText(label))).not.toThrow()
      expect(container.querySelector('.lp-drawer')!.className).not.toContain('lp-drawer--open')
    }
  })

  it('focuses a same-page target whose id is not a valid selector', () => {
    const target = document.createElement('section')
    target.id = '2024-results'
    // jsdom implements no scrolling at all, so scrollIntoView is simply absent.
    // No prior test reached this branch, which is how the selector bug survived.
    target.scrollIntoView = () => {}
    document.body.append(target)
    const { getByText } = render(
      <NavChrome brand="M" links={[{ href: '#2024-results', label: 'Results' }]} />
    )
    fireEvent.click(getByText('Results'))
    expect(document.activeElement).toBe(target)
    target.remove()
  })

  it('applies a host-supplied navLabel', () => {
    const { getByRole } = render(<NavChrome brand="M" links={LINKS} navLabel="Primary" />)
    expect(getByRole('navigation', { name: 'Primary' })).toBeTruthy()
  })

  // The bar was a <header>, which is a `banner` landmark unless it descends
  // from main/article/aside/nav/section — and what suppressed it was `Deck`
  // rendering a <main>, which it no longer does. Rendered where the host's site
  // header already claims that landmark, a second banner is announced beside it
  // with nothing to distinguish the two. Asserted through `getByRole` rather
  // than the tag, because the defect is the ROLE, and a `role="banner"` on any
  // element would bring it back.
  it('claims no banner landmark, so the host keeps the only one', () => {
    const { container, queryAllByRole } = render(<NavChrome brand="M" links={LINKS} />)
    expect(queryAllByRole('banner')).toHaveLength(0)
    expect(container.querySelector('.lp-bar')!.tagName).toBe('DIV')
  })

  // A host with its own site header has no second wordmark to draw here, and an
  // empty .lp-brand would still sit centred in the bar.
  it('draws no brand element when the host gives no brand', () => {
    const { container } = render(<NavChrome links={LINKS} />)
    expect(container.querySelector('.lp-brand')).toBeNull()
    expect(container.querySelector('.lp-burger')).toBeTruthy()
  })

  // The scrim dismisses on click but is not a control: focus is trapped inside
  // the drawer while it is open, so a button out here is unreachable by
  // keyboard however it is labelled — leaving only a full-viewport control
  // announced as covering the page.
  it('leaves the scrim unfocusable and unannounced', () => {
    const { container } = render(<NavChrome links={LINKS} />)
    const scrim = container.querySelector('.lp-scrim')!
    expect(scrim.tagName).toBe('DIV')
    expect(scrim.getAttribute('aria-hidden')).toBe('true')
    expect(scrim.hasAttribute('tabindex')).toBe(false)
  })

  describe('while open, the keyboard is held inside the drawer', () => {
    it('wraps forward off the last control back to the first', () => {
      const { getByLabelText, getByText } = render(<NavChrome links={LINKS} />)
      fireEvent.click(getByLabelText('Open menu'))
      const close = getByLabelText('Close menu')
      const last = getByText('Two')
      last.focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(document.activeElement).toBe(close)
    })

    it('wraps backward off the first control onto the last', () => {
      const { getByLabelText, getByText } = render(<NavChrome links={LINKS} />)
      fireEvent.click(getByLabelText('Open menu'))
      getByLabelText('Close menu').focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(document.activeElement).toBe(getByText('Two'))
    })

    // The case an onKeyDown on the <nav> could never see: focus already outside
    // it — a stray click on the scrim, a browser restoring it after an alt-tab.
    it('pulls focus back in when Tab is pressed from outside', () => {
      const stray = document.createElement('button')
      document.body.append(stray)
      const { getByLabelText } = render(<NavChrome links={LINKS} />)
      fireEvent.click(getByLabelText('Open menu'))
      stray.focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(document.activeElement).toBe(getByLabelText('Close menu'))
      stray.remove()
    })

    it('lets Tab go where it likes once the drawer is shut', () => {
      const stray = document.createElement('button')
      document.body.append(stray)
      const { getByLabelText } = render(<NavChrome links={LINKS} />)
      stray.focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(document.activeElement).toBe(stray)
      stray.remove()
    })
  })

  // The focus-return on close is for a DISMISSAL. Arriving somewhere by picking
  // a link is not one, and letting the return run would take the focus `go` just
  // placed on the target and announce the menu button instead.
  it('leaves focus on the target when a link closed the drawer', () => {
    const target = document.createElement('section')
    target.id = 'two'
    target.scrollIntoView = () => {}
    document.body.append(target)
    const { getByLabelText, getByText } = render(<NavChrome links={LINKS} />)
    fireEvent.click(getByLabelText('Open menu'))
    fireEvent.click(getByText('Two'))
    expect(document.activeElement).toBe(target)
    target.remove()
  })

  // ...but a link that goes off-page has no arrival to announce, so the burger
  // still gets focus back.
  it('returns focus to the burger when the link went off-page', () => {
    const { getByLabelText, getByText } = render(
      <NavChrome links={[{ href: 'https://example.com/x', label: 'Docs' }]} />
    )
    const burger = getByLabelText('Open menu')
    fireEvent.click(burger)
    fireEvent.click(getByText('Docs'))
    expect(document.activeElement).toBe(burger)
  })
})
