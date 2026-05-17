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
import { SearchDialogConnected } from '@agentic-web-toolkit/controls/search-dialog'
import { AppearanceModeToggle } from '@agentic-web-toolkit/controls/appearance-mode-toggle'
import { ColorModeProvider } from '@agentic-web-toolkit/themes'

import '@agentic-web-toolkit/controls/search-dialog/styles.css'
import '@agentic-web-toolkit/controls/appearance-mode-toggle/styles.css'

export const meta = { id: 'controls', label: 'Controls' }

const config: SiteConfig = {
  branding: { title: 'Controls Demo', titleEmphasis: 'The' },
  meta: { description: '', siteUrl: '' },
  hero: { heading: 'Controls', body: '' },
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

function Inner() {
  const [open, setOpen] = useState(false)
  const [pathname, setPathname] = useState('/')
  const route = useMemo(
    () => ({ pathname, hash: '', navigate: (to: string) => setPathname(to) }),
    [pathname],
  )
  return (
    <RouteProvider {...route}>
      <ExamplePanel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ color: 'var(--color-accent)', margin: 0, flex: 1 }}>Controls</h1>
          <AppearanceModeToggle />
        </div>

        <p style={{ color: 'var(--color-text-secondary)' }}>
          Cycle theme with the toggle in the top-right (auto → dark → light). Open the search
          dialog with the button below.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent, white)',
            border: 0,
            cursor: 'pointer',
          }}
        >
          Open search
        </button>

        <p style={{ marginTop: 24 }}>
          Current route: <code>{pathname}</code>
        </p>

        <SearchDialogConnected open={open} onClose={() => setOpen(false)} />
      </ExamplePanel>
    </RouteProvider>
  )
}

export default function ControlsExample() {
  return (
    <ColorModeProvider>
      <SiteConfigProvider config={config}>
        <ContentProvider entries={entries}>
          <Inner />
        </ContentProvider>
      </SiteConfigProvider>
    </ColorModeProvider>
  )
}
