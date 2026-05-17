import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SectionCard } from '../SectionCard'

describe('SectionCard', () => {
  it('renders title, count, and description', () => {
    const { container } = render(
      <SectionCard
        section={{ key: 'guides', label: 'Guides', path: '/guides', description: 'Tutorials' }}
        count={5}
      />,
    )
    expect(container.querySelector('.awt-section-card__title')?.textContent).toBe('Guides')
    expect(container.querySelector('.awt-section-card__count')?.textContent).toBe('5')
    expect(container.querySelector('.awt-section-card__description')?.textContent).toBe('Tutorials')
  })

  it('links to the section path', () => {
    const { container } = render(
      <SectionCard section={{ key: 'guides', label: 'Guides', path: '/guides' }} count={0} />,
    )
    const a = container.querySelector('a.awt-section-card') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('/guides')
  })

  it('omits description when missing', () => {
    const { container } = render(
      <SectionCard section={{ key: 'guides', label: 'Guides', path: '/guides' }} count={0} />,
    )
    expect(container.querySelector('.awt-section-card__description')).toBeNull()
  })
})
