import { describe, it, expect } from 'vitest'
import { slugToBreadcrumbs } from '../breadcrumbs'

describe('slugToBreadcrumbs', () => {
  it('returns empty array for root', () => {
    expect(slugToBreadcrumbs('/')).toEqual([])
  })

  it('produces one breadcrumb per path segment, no Home prefix', () => {
    expect(slugToBreadcrumbs('/guides/install')).toEqual([
      { label: 'Guides', path: '/guides' },
      { label: 'Install', path: '/guides/install' },
    ])
  })

  it('title-cases dashed segments', () => {
    expect(slugToBreadcrumbs('/api/getting-started')[1]).toEqual({
      label: 'Getting Started',
      path: '/api/getting-started',
    })
  })
})
