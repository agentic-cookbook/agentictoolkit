/** ResourceCard — the /home resource card, and now the cookbook's section-index
 *  card. The three roots (link / button / inert) are the whole contract, so each
 *  gets a test; the pre-existing two must render exactly as they did before the
 *  `href` prop was added. */

import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { ResourceCard } from '../blocks/resource-card'
import type { DocLinkComponent } from '../blocks/doc-types'

describe('ResourceCard', () => {
  it('renders an inert div when the host passes neither href nor onClick', () => {
    const { container } = render(<ResourceCard title="Ecosystem" />)
    const root = container.firstElementChild!
    expect(root.tagName).toBe('DIV')
    expect(root.getAttribute('role')).toBeNull()
    expect(root.getAttribute('tabindex')).toBeNull()
    expect(root.className).not.toContain('cursor-pointer')
  })

  it('renders a keyboard-operable div[role=button] for onClick', () => {
    const onClick = vi.fn()
    render(<ResourceCard title="Ecosystem" onClick={onClick} />)
    const root = screen.getByRole('button')
    expect(root.tagName).toBe('DIV')
    expect(root.getAttribute('tabindex')).toBe('0')

    fireEvent.click(root)
    fireEvent.keyDown(root, { key: 'Enter' })
    fireEvent.keyDown(root, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(root, { key: 'a' })
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('renders a real anchor for href — the thing ⌘-click and "copy link" need', () => {
    render(<ResourceCard title="Simplicity" href="/principles/simplicity" />)
    const root = screen.getByRole('link')
    expect(root.tagName).toBe('A')
    expect(root.getAttribute('href')).toBe('/principles/simplicity')
    // Not also announced as a button, and not separately tab-stopped.
    expect(screen.queryByRole('button')).toBeNull()
    expect(root.getAttribute('tabindex')).toBeNull()
    expect(root.className).toContain('cursor-pointer')
  })

  it('routes href through the injected LinkComponent, never a hardcoded router', () => {
    const RouterLink: DocLinkComponent = ({ to, children, ...rest }) => (
      <a data-router="yes" href={`#${to}`} {...rest}>
        {children}
      </a>
    )
    render(
      <ResourceCard title="Simplicity" href="/x" LinkComponent={RouterLink} />,
    )
    const root = screen.getByRole('link')
    expect(root.getAttribute('data-router')).toBe('yes')
    expect(root.getAttribute('href')).toBe('#/x')
    // The card's own classes must survive the adapter's prop spread, or the
    // host's router silently costs the card its styling.
    expect(root.className).toContain('rounded-xl')
  })

  it('nests the block content inside the anchor — <a> takes flow content', () => {
    render(
      <ResourceCard
        href="/x"
        title="Simplicity"
        identifier="com.example.simplicity"
        description="No interleaving of concerns."
        meta={<span>principles</span>}
      />,
    )
    const root = screen.getByRole('link')
    expect(root.querySelector('p')!.textContent).toBe(
      'No interleaving of concerns.',
    )
    expect(root.textContent).toContain('com.example.simplicity')
    expect(root.textContent).toContain('principles')
  })

  it('lets the host override geometry through className — twMerge, not append', () => {
    const { container } = render(
      <ResourceCard title="Simplicity" href="/x" className="rounded-lg p-4" />,
    )
    const { className } = container.firstElementChild!
    expect(className).toContain('rounded-lg')
    expect(className).not.toContain('rounded-xl')
    expect(className).toContain('p-4')
    expect(className).not.toContain('p-5')
  })

  it('fires onClick alongside navigation when the host passes both', () => {
    const onClick = vi.fn()
    render(<ResourceCard title="Simplicity" href="/x" onClick={onClick} />)
    fireEvent.click(screen.getByRole('link'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
