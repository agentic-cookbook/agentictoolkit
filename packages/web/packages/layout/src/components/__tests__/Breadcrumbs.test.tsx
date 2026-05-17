import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Breadcrumbs } from '../Breadcrumbs'

describe('Breadcrumbs', () => {
  it('renders one item per breadcrumb entry', () => {
    const { container } = render(
      <Breadcrumbs trail={[{ label: 'Home', path: '/' }, { label: 'Guides', path: '/g' }]} />,
    )
    const items = container.querySelectorAll('.awt-breadcrumbs__item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Home')
    expect(items[1].textContent).toContain('Guides')
  })

  it('marks the last item as current', () => {
    const { container } = render(
      <Breadcrumbs trail={[{ label: 'Home', path: '/' }, { label: 'Guides', path: '/g' }]} />,
    )
    const last = container.querySelector('.awt-breadcrumbs__item--current')
    expect(last?.textContent).toContain('Guides')
  })
})
