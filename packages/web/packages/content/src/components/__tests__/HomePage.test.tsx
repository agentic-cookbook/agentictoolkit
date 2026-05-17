import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HomePage } from '../HomePage'

describe('HomePage', () => {
  it('renders the hero heading and meta', () => {
    const { container, getByText } = render(
      <HomePage
        hero={{ heading: 'Welcome', body: 'Intro body' }}
        sections={[
          { section: { key: 'guides', label: 'Guides', path: '/guides' }, count: 3 },
          { section: { key: 'api', label: 'API', path: '/api' }, count: 2 },
        ]}
        entryCount={5}
      />,
    )
    expect(container.querySelector('.awt-home__heading')?.textContent).toBe('Welcome')
    expect(getByText('Intro body')).toBeTruthy()
    expect(container.querySelectorAll('.awt-section-card').length).toBe(2)
  })

  it('renders external links when provided', () => {
    const { container } = render(
      <HomePage
        hero={{ heading: 'Welcome', body: '' }}
        sections={[]}
        entryCount={0}
        externalLinks={[{ label: 'GitHub', href: 'https://github.com' }]}
      />,
    )
    const a = container.querySelector('.awt-home__external-link') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://github.com')
    expect(a.getAttribute('target')).toBe('_blank')
  })
})
