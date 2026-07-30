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

  it('applies a host-supplied dismissLabel and navLabel', () => {
    const { getByLabelText, getByRole } = render(
      <NavChrome brand="M" links={LINKS} dismissLabel="Shut menu" navLabel="Primary" />
    )
    expect(getByLabelText('Shut menu')).toBeTruthy()
    expect(getByRole('navigation', { name: 'Primary' })).toBeTruthy()
  })
})
