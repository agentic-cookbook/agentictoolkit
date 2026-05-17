'use client'

import { useState } from 'react'
import { ExamplePanel } from '../../src/ExamplePanel'
import {
  SiteConfigProvider,
  ContentProvider,
  useContent,
  useSiteConfig,
  type SiteConfig,
  type SiteEntry,
} from '@agentic-web-toolkit/model'

export const meta = { id: 'site-model', label: 'Site Model' }

const config: SiteConfig = {
  branding: { title: 'Site Model Demo', titleEmphasis: 'The' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: 'Site Model', body: '' },
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
  make('/api/auth', 'api', 'Authentication', 'API auth flows'),
]

function Inner() {
  const { branding } = useSiteConfig()
  const { entries: e, navTree, searchIndex } = useContent()
  const [q, setQ] = useState('')
  const results = searchIndex.query(q)
  return (
    <ExamplePanel>
      <h1 style={{ color: 'var(--color-accent)' }}>{branding.title}</h1>
      <p>
        Loaded {e.length} entries across {navTree.length} sections.
      </p>
      <h2>Nav tree</h2>
      <ul>
        {navTree.map((n) => (
          <li key={n.path}>
            <strong>{n.label}</strong>
            <ul>
              {n.children.map((c) => (
                <li key={c.path}>{c.label}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <h2>Search</h2>
      <input
        placeholder="Try 'install' or 'auth'"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        style={{
          padding: 8,
          width: '100%',
          maxWidth: 400,
          background: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        }}
      />
      <ul>
        {results.map((r) => (
          <li key={r.entry.slug}>
            {r.entry.frontmatter.title}{' '}
            <span style={{ opacity: 0.6 }}>— {String(r.entry.frontmatter.summary ?? '')}</span>
          </li>
        ))}
      </ul>
    </ExamplePanel>
  )
}

export default function SiteModelExample() {
  return (
    <SiteConfigProvider config={config}>
      <ContentProvider entries={entries}>
        <Inner />
      </ContentProvider>
    </SiteConfigProvider>
  )
}
