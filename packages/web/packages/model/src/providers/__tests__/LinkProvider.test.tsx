import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LinkProvider, useLink } from '../LinkProvider'
import type { ComponentType, ReactNode } from 'react'

function Probe() {
  const Link = useLink()
  return <Link to="/x">click</Link>
}

describe('LinkProvider', () => {
  it('defaults to plain anchor with href', () => {
    const { container } = render(<Probe />)
    const anchor = container.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('/x')
    expect(anchor?.textContent).toBe('click')
  })

  it('honors injected Component', () => {
    const Custom: ComponentType<{ to: string; children?: ReactNode }> = ({ to, children }) => (
      <span data-router-link={to}>{children}</span>
    )
    const { container } = render(
      <LinkProvider Component={Custom}>
        <Probe />
      </LinkProvider>,
    )
    expect(container.querySelector('[data-router-link="/x"]')?.textContent).toBe('click')
  })
})
