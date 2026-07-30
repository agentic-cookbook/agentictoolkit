import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { StorySections } from '../marketing/StorySections'
import { BRAND_PROMISE, PILLAR_COPY } from '../marketing/story-copy'
import { SITE_STORIES } from '@agentic-toolkit/adh-registry'
import { SITES, getSite, siteHeaderTitle } from '@agentic-toolkit/adh-registry'

describe('StorySections', () => {
  it('renders the promise, the site pillar, and the next-step link', () => {
    render(<StorySections siteId="academy" />)
    expect(screen.getByText(BRAND_PROMISE)).toBeInTheDocument()
    expect(
      screen.getByText(PILLAR_COPY[SITE_STORIES.academy.pillar].title),
    ).toBeInTheDocument()
    const next = getSite(SITE_STORIES.academy.nextStep)!
    const link = screen.getByRole('link', {
      name: new RegExp(siteHeaderTitle(next)),
    })
    expect(link).toHaveAttribute('href', `https://${next.prodHost}/`)
  })

  it('the masterbrand carries all three pillars; satellites carry provenance', () => {
    render(<StorySections siteId="hub" />)
    for (const pillar of Object.values(PILLAR_COPY)) {
      expect(screen.getByText(pillar.title)).toBeInTheDocument()
    }
    render(<StorySections siteId="toolkit" />)
    expect(screen.getByText('From the Agentic Developer Hub')).toBeInTheDocument()
  })

  it('renders for every registered site (story data is always complete)', () => {
    for (const site of SITES) {
      const { unmount } = render(<StorySections siteId={site.id} />)
      unmount()
    }
  })
})
