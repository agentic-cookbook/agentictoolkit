// src/__tests__/BitbagMini.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Stub the avatar so the test observes exactly the props BitbagMini emits —
// the essence of "mini" (pinned expression + muted) — without mounting the
// gsap-driven engine, which has nothing to assert here and would only add flake.
vi.mock('../avatar', () => ({
  Bitbag: (props: { expression?: string; mute?: boolean }) => (
    <span
      data-testid="bitbag"
      data-expression={props.expression ?? ''}
      data-mute={String(props.mute ?? false)}
    />
  ),
}))

import { BitbagMini } from '../BitbagMini'

describe('BitbagMini', () => {
  it('pins bitbag idle and muted by default', () => {
    render(<BitbagMini />)
    const bb = screen.getByTestId('bitbag')
    expect(bb).toHaveAttribute('data-expression', 'idle')
    expect(bb).toHaveAttribute('data-mute', 'true')
  })

  it('honours an explicit expression while staying muted', () => {
    render(<BitbagMini expression="smug" />)
    const bb = screen.getByTestId('bitbag')
    expect(bb).toHaveAttribute('data-expression', 'smug')
    expect(bb).toHaveAttribute('data-mute', 'true')
  })

  it('is a bare, non-link element sized to the default width', () => {
    const { container } = render(<BitbagMini />)
    expect(container.querySelector('a')).toBeNull()
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.style.width).toBe('112px')
  })

  it('sizes to the given width', () => {
    const { container } = render(<BitbagMini size={64} />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.width).toBe('64px')
  })

  it('becomes a new-tab link wrapping the avatar when href is set', () => {
    render(<BitbagMini href="https://bitbag.hub.adh.com" label="bitbag — meet him" size={96} />)
    const link = screen.getByRole('link', { name: 'bitbag — meet him' })
    expect(link).toHaveAttribute('href', 'https://bitbag.hub.adh.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveStyle({ width: '96px', display: 'block' })
    // the avatar lives inside the link, still pinned idle + muted
    const bb = screen.getByTestId('bitbag')
    expect(link).toContainElement(bb)
    expect(bb).toHaveAttribute('data-expression', 'idle')
    expect(bb).toHaveAttribute('data-mute', 'true')
  })

  it('passes className through to the outer element', () => {
    const { container } = render(<BitbagMini className="shrink-0" />)
    expect(container.firstElementChild).toHaveClass('shrink-0')
  })
})
