import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import Header from '../components/layout/Header'
import { SiteConfigProvider } from '../contexts/SiteConfigContext'
import { ColorModeProvider } from '@agentic-web-toolkit/themes/colorMode'
import type { SiteConfig } from '../types'

function makeConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    branding: { title: 'Site' },
    meta: { description: 'd', siteUrl: 'https://example.com' },
    hero: { heading: 'h', body: 'b' },
    nav: { sections: [] },
    ...overrides,
  }
}

function renderHeader(config: SiteConfig) {
  return render(
    <MemoryRouter>
      <SiteConfigProvider config={config}>
        <ColorModeProvider>
          <Header onMenuToggle={vi.fn()} onSearchOpen={vi.fn()} />
        </ColorModeProvider>
      </SiteConfigProvider>
    </MemoryRouter>,
  )
}

describe('Header', () => {
  it('renders branding.title', () => {
    renderHeader(makeConfig({ branding: { title: 'Acme Docs' } }))
    expect(screen.getByText('Acme Docs')).toBeInTheDocument()
  })

  it('renders branding.titleEmphasis when set', () => {
    renderHeader(
      makeConfig({ branding: { title: 'Cookbook', titleEmphasis: 'The' } }),
    )
    expect(screen.getByText('The')).toBeInTheDocument()
    expect(screen.getByText('Cookbook')).toBeInTheDocument()
  })

  it('renders github link when githubUrl is set', () => {
    renderHeader(
      makeConfig({
        branding: { title: 'X', githubUrl: 'https://github.com/o/r' },
      }),
    )
    const link = screen.getByLabelText('View on GitHub') as HTMLAnchorElement
    expect(link.href).toBe('https://github.com/o/r')
  })

  it('omits github link when githubUrl is unset', () => {
    renderHeader(makeConfig({ branding: { title: 'X' } }))
    expect(screen.queryByLabelText('View on GitHub')).toBeNull()
  })

  it('hides search trigger when features.search is false', () => {
    renderHeader(makeConfig({ features: { search: false } }))
    expect(screen.queryByText('Search...')).toBeNull()
  })
})
