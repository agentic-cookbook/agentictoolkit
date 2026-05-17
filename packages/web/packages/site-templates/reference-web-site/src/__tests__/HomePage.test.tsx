import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { SiteConfigProvider } from '../contexts/SiteConfigContext'
import type { SiteConfig } from '../types'

vi.mock('virtual:reference-site-content', () => ({
  default: [
    {
      slug: '/docs/intro',
      section: 'docs',
      raw: '',
      html: '<p>intro</p>',
      headings: [],
      frontmatter: { title: 'Intro' },
    },
  ],
}))

const HomePage = (await import('../components/sections/HomePage')).default
const { ContentProvider } = await import('../contexts/ContentContext')

function makeConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    branding: { title: 'Site' },
    meta: { description: 'd', siteUrl: 'https://example.com' },
    hero: { heading: 'My Site', body: <p>Welcome</p> },
    nav: {
      sections: [
        { key: 'docs', label: 'Docs', description: 'Documentation', path: '/docs' },
        { key: 'guides', label: 'Guides', description: 'Step-by-step', path: '/guides' },
      ],
    },
    ...overrides,
  }
}

function renderHome(config: SiteConfig) {
  return render(
    <MemoryRouter>
      <SiteConfigProvider config={config}>
        <ContentProvider>
          <HomePage />
        </ContentProvider>
      </SiteConfigProvider>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('renders hero heading from config', () => {
    renderHome(makeConfig())
    expect(screen.getByText('My Site')).toBeInTheDocument()
  })

  it('renders hero body from config', () => {
    renderHome(makeConfig())
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('renders one card per nav section', () => {
    renderHome(makeConfig())
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Guides')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Step-by-step')).toBeInTheDocument()
  })

  it('renders external links when configured', () => {
    renderHome(
      makeConfig({
        nav: {
          sections: [],
          externalLinks: [
            { label: 'Sister Site', href: 'https://sister.example', description: 'Friend' },
          ],
        },
      }),
    )
    const link = screen.getByText('Sister Site').closest('a') as HTMLAnchorElement
    expect(link.href).toBe('https://sister.example/')
    expect(screen.getByText('Friend')).toBeInTheDocument()
  })
})
