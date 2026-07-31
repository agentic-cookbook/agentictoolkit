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

  it('applies a host-supplied dismissLabel and navLabel', () => {
    const { getByLabelText, getByRole } = render(
      <NavChrome brand="M" links={LINKS} dismissLabel="Shut menu" navLabel="Primary" />
    )
    expect(getByLabelText('Shut menu')).toBeTruthy()
    expect(getByRole('navigation', { name: 'Primary' })).toBeTruthy()
  })
})
