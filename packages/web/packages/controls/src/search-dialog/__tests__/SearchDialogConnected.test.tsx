import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SearchDialogConnected } from '../SearchDialogConnected'
import { SiteConfigProvider } from '@agentic-web-toolkit/model'
import { ContentProvider } from '@agentic-web-toolkit/model'
import { RouteProvider } from '@agentic-web-toolkit/model'
import type { SiteConfig, SiteEntry } from '@agentic-web-toolkit/model'

const config: SiteConfig = {
  branding: { title: 'T', titleEmphasis: 'E' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: '', body: '' },
  nav: {
    sections: [
      { key: 'guides', label: 'Guides', path: '/guides' },
    ],
  },
}

const entries: SiteEntry[] = [
  {
    slug: '/guides/install',
    section: 'guides',
    raw: '',
    html: '',
    headings: [],
    frontmatter: { title: 'Install', summary: 'How to install' },
  },
]

describe('SearchDialogConnected', () => {
  it('navigates and closes when an entry is selected', () => {
    const navigate = vi.fn()
    const onClose = vi.fn()
    const { container } = render(
      <SiteConfigProvider config={config}>
        <ContentProvider entries={entries}>
          <RouteProvider pathname="/" hash="" navigate={navigate}>
            <SearchDialogConnected open={true} onClose={onClose} />
          </RouteProvider>
        </ContentProvider>
      </SiteConfigProvider>,
    )
    const input = container.querySelector('.awt-search-dialog__input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'install' } })
    const result = container.querySelector('.awt-search-dialog__result') as HTMLButtonElement
    fireEvent.click(result)
    expect(navigate).toHaveBeenCalledWith('/guides/install')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
