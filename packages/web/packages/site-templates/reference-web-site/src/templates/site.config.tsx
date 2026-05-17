import type { SiteConfig } from 'agentic-web-toolkit/reference-web-site'

export const siteConfig: SiteConfig = {
  branding: {
    title: 'My Site',
    titleEmphasis: 'The',
    githubUrl: 'https://github.com/example/example',
  },
  meta: {
    description: 'A reference site built with agentic-web-toolkit.',
    siteUrl: 'https://example.com',
  },
  hero: {
    heading: (
      <>
        <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>The</em> My Site
      </>
    ),
    body: (
      <p>
        Replace this with your own intro copy. Add nav sections below to surface
        your content.
      </p>
    ),
  },
  nav: {
    sections: [
      {
        key: 'docs',
        label: 'Docs',
        description: 'Documentation entries.',
        path: '/docs',
      },
    ],
  },
}
