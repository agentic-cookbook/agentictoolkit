import { MemoryRouter } from 'react-router'
import { ExamplePanel } from '../../ExamplePanel'
import {
  ReferenceSiteApp,
  type SiteConfig,
} from '@agentic-web-toolkit/reference-web-site'
import '@agentic-web-toolkit/reference-web-site/styles/tokens.css'
import '@agentic-web-toolkit/controls/appearance-mode-toggle/styles.css'

export const meta = { id: 'reference-web-site', label: 'Reference Site' }

const siteConfig: SiteConfig = {
  branding: {
    title: 'Demo',
    titleEmphasis: 'The',
    githubUrl: 'https://github.com/agentic-cookbook/agentic-web-toolkit',
  },
  meta: {
    description: 'Sample reference-web-site example.',
    siteUrl: 'https://example.com',
  },
  hero: {
    heading: (
      <>
        <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>The</em>{' '}
        Demo Site
      </>
    ),
    body: (
      <>
        <p style={{ marginBottom: '1rem' }}>
          This panel is a fully working <code>reference-web-site</code> SPA,
          rendered with <code>MemoryRouter</code> so it doesn&rsquo;t hijack the
          examples shell&rsquo;s URL.
        </p>
        <p>
          The sidebar nav, fuzzy search (⌘K), per-page TOC, theme toggle, and
          markdown rendering are all built in. The content under{' '}
          <code>site/src/examples/reference-web-site/content/</code> is what
          you&rsquo;re browsing. Pick a theme from the rail on the left to
          restyle every example at once.
        </p>
      </>
    ),
  },
  nav: {
    sections: [
      {
        key: 'guides',
        label: 'Guides',
        description: 'How to install and configure the package.',
        path: '/guides',
      },
    ],
  },
}

export default function ReferenceWebSiteExample() {
  return (
    <ExamplePanel>
      <MemoryRouter>
        <ReferenceSiteApp config={siteConfig} />
      </MemoryRouter>
    </ExamplePanel>
  )
}
