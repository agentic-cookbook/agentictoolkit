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
  AppShell,
  HeaderConnected,
  SidebarConnected,
  BreadcrumbsConnected,
  TableOfContents,
} from '@agentic-web-toolkit/layout'

import '@agentic-web-toolkit/layout/css/base.css'
import '@agentic-web-toolkit/layout/css/header.css'
import '@agentic-web-toolkit/layout/css/sidebar.css'
import '@agentic-web-toolkit/layout/css/breadcrumbs.css'
import '@agentic-web-toolkit/layout/css/toc.css'
import '@agentic-web-toolkit/layout/css/app-shell.css'

export const meta = { id: 'layout', label: 'Layout' }

const config: SiteConfig = {
  branding: { title: 'Layout Demo', titleEmphasis: 'The' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: 'Layout', body: '' },
  nav: {
    sections: [
      { key: 'guides', label: 'Guides', path: '/guides' },
      { key: 'api', label: 'API', path: '/api' },
    ],
  },
}

const make = (slug: string, section: string, title: string, summary: string): SiteEntry => ({
  slug,
  section,
  raw: '',
  html: '',
  headings: [],
  frontmatter: { title, summary },
})

const entries: SiteEntry[] = [
  make('/guides/install', 'guides', 'Install', 'Install the toolkit'),
  make('/guides/configure', 'guides', 'Configure', 'Set up your config'),
  make('/guides/theming', 'guides', 'Theming', 'Customize your theme'),
  make('/api/auth', 'api', 'Authentication', 'API auth flows'),
  make('/api/sessions', 'api', 'Sessions', 'Session management'),
]

const pageHeadings = [
  { id: 'overview', text: 'Overview', depth: 2 },
  { id: 'usage', text: 'Usage', depth: 2 },
  { id: 'props', text: 'Props', depth: 3 },
  { id: 'examples', text: 'Examples', depth: 2 },
]

function PageBody({ pathname }: { pathname: string }) {
  const entry = entries.find((e) => e.slug === pathname)
  return (
    <div>
      <BreadcrumbsConnected />
      <h1 style={{ color: 'var(--color-accent)' }}>
        {entry?.frontmatter.title ?? 'Welcome'}
      </h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {entry ? String(entry.frontmatter.summary ?? '') : 'Pick a page from the sidebar.'}
      </p>
      <h2 id="overview">Overview</h2>
      <p>
        This demo composes <code>AppShell</code>, <code>HeaderConnected</code>,{' '}
        <code>SidebarConnected</code>, <code>BreadcrumbsConnected</code>, and{' '}
        <code>TableOfContents</code> from the layout package, all backed by site-model providers.
      </p>
      <h2 id="usage">Usage</h2>
      <p>Use the sidebar to navigate. The breadcrumbs and TOC update with the route.</p>
      <h3 id="props">Props</h3>
      <p>Each component exposes a prop-driven API plus a Connected variant.</p>
      <h2 id="examples">Examples</h2>
      <p>See the source of this example for a working integration.</p>
    </div>
  )
}

export default function LayoutExample() {
  const [pathname, setPathname] = useState('/guides/install')
  const route = useMemo(
    () => ({ pathname, hash: '', navigate: (to: string) => setPathname(to) }),
    [pathname],
  )
  return (
    <SiteConfigProvider config={config}>
      <ContentProvider entries={entries}>
        <RouteProvider {...route}>
          <ExamplePanel>
            <AppShell
              header={<HeaderConnected />}
              sidebar={<SidebarConnected onNavigate={setPathname} />}
              toc={<TableOfContents headings={pageHeadings} />}
            >
              <PageBody pathname={pathname} />
            </AppShell>
          </ExamplePanel>
        </RouteProvider>
      </ContentProvider>
    </SiteConfigProvider>
  )
}
