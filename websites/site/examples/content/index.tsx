'use client'

import { useMemo, useState } from 'react'
import { ExamplePanel } from '../../src/ExamplePanel'
import {
  SiteConfigProvider,
  ContentProvider,
  RouteProvider,
  type SiteConfig,
  type SiteEntry,
} from '@agentic-web-toolkit/model'
import {
  HomePageConnected,
  SectionIndexConnected,
  MarkdownView,
} from '@agentic-web-toolkit/content'

import '@agentic-web-toolkit/content/css/cards.css'
import '@agentic-web-toolkit/content/css/home-page.css'
import '@agentic-web-toolkit/content/css/section-index.css'
import '@agentic-web-toolkit/content/css/markdown-view.css'

export const meta = { id: 'content', label: 'Content' }

const config: SiteConfig = {
  branding: { title: 'Content Demo', titleEmphasis: 'The' },
  meta: { description: '', siteUrl: '' },
  hero: {
    heading: 'Content Demo',
    body: 'A composed home page, section index, and rendered markdown — all driven by site-model providers and themed via CSS tokens.',
  },
  nav: {
    sections: [
      { key: 'guides', label: 'Guides', path: '/guides', description: 'Step-by-step tutorials' },
      { key: 'api', label: 'API', path: '/api', description: 'Reference for every endpoint' },
    ],
    externalLinks: [
      {
        label: 'GitHub',
        href: 'https://github.com',
        description: 'Source code and issue tracker',
      },
    ],
  },
}

const make = (
  slug: string,
  section: string,
  title: string,
  summary: string,
  html = '',
): SiteEntry => ({
  slug,
  section,
  raw: '',
  html,
  headings: [],
  frontmatter: { title, summary },
})

const sampleHtml = `
  <h1>Install</h1>
  <p>Welcome to the install guide. This page is rendered through <code>MarkdownView</code>.</p>
  <h2>Prerequisites</h2>
  <ul><li>Node 20+</li><li>npm 10+</li></ul>
  <h2>Quickstart</h2>
  <pre><code>npm install @agentic-cookbook/agentic-web-toolkit</code></pre>
  <blockquote>Themed via <code>--color-*</code> tokens — no Tailwind utility classes.</blockquote>
`

const entries: SiteEntry[] = [
  make('/guides/install', 'guides', 'Install', 'Install the toolkit', sampleHtml),
  make('/guides/configure', 'guides', 'Configure', 'Set up your config'),
  make('/guides/theming', 'guides', 'Theming', 'Customize your theme'),
  make('/api/auth', 'api', 'Authentication', 'API auth flows'),
  make('/api/sessions', 'api', 'Sessions', 'Session management'),
]

const TABS = [
  { key: 'home', label: 'HomePage' },
  { key: 'section', label: 'SectionIndex' },
  { key: 'markdown', label: 'MarkdownView' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ContentExample() {
  const [tab, setTab] = useState<TabKey>('home')
  const [pathname, setPathname] = useState('/')
  const route = useMemo(
    () => ({ pathname, hash: '', navigate: (to: string) => setPathname(to) }),
    [pathname],
  )

  return (
    <SiteConfigProvider config={config}>
      <ContentProvider entries={entries}>
        <RouteProvider {...route}>
          <ExamplePanel>
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 16,
                borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface-raised)',
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--color-border)',
                    background:
                      tab === t.key ? 'var(--color-accent)' : 'var(--color-surface)',
                    color:
                      tab === t.key
                        ? 'var(--color-on-accent, white)'
                        : 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'home' && <HomePageConnected />}
            {tab === 'section' && (
              <SectionIndexConnected sectionPath="/guides" title="Guides" />
            )}
            {tab === 'markdown' && (
              <div className="awt-section-index">
                <div className="awt-section-index__head">
                  <h1 className="awt-section-index__title">MarkdownView</h1>
                  <p className="awt-section-index__count">
                    Rendered from a static HTML string
                  </p>
                </div>
                <MarkdownView html={sampleHtml} />
              </div>
            )}
          </ExamplePanel>
        </RouteProvider>
      </ContentProvider>
    </SiteConfigProvider>
  )
}
