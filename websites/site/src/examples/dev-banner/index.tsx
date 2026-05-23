'use client'

import { useState } from 'react'
import { ExamplePanel } from '../../ExamplePanel'
import { DevBanner } from '@agentic-toolkit/controls/dev-banner'
import '@agentic-toolkit/controls/dev-banner/styles.css'
import { SourceCodePanel } from '@agentic-toolkit/controls/source-code-panel'
import '@agentic-toolkit/controls/source-code-panel/styles.css'

export const meta = { id: 'dev-banner', label: 'Dev Banner' }

const DEFAULT_MESSAGE = 'Development Preview — Coming Soon!'

export default function DevBannerExample() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [showFixed, setShowFixed] = useState(false)

  return (
    <ExamplePanel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Dev Banner</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            A rotated gold pill that signals a site is a development preview. Use{' '}
            <code>position="fixed"</code> (the default) to pin it to the top of the viewport
            on every page, or <code>position="static"</code> to embed it inline. Pass a{' '}
            <code>message</code> to customize the text; the default is{' '}
            <em>"Development Preview — Coming Soon!"</em>.
          </p>
        </header>

        <section style={controlsStyle}>
          <label style={controlLabelStyle}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Message
            </span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ ...controlLabelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="checkbox"
              checked={showFixed}
              onChange={(e) => setShowFixed(e.target.checked)}
            />
            <span style={{ fontSize: '0.82rem' }}>Preview fixed variant (overlays the page)</span>
          </label>
        </section>

        <section
          style={{
            background: '#0c0c0f',
            border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
            borderRadius: 8,
            padding: '3.5rem 1rem 3rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 140,
            overflow: 'hidden',
          }}
        >
          <DevBanner message={message} position="static" />
        </section>

        {showFixed ? <DevBanner message={message} position="fixed" /> : null}

        <section>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>How the consumer wires it up</h2>
          <SourceCodePanel filename="usage.tsx" lang="tsx" code={CONSUMER_SOURCE} />
        </section>

        <section>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Styles</h2>
          <SourceCodePanel filename="dev-banner.css" lang="css" code={STYLES_SOURCE} />
        </section>
      </div>
    </ExamplePanel>
  )
}

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
  borderRadius: 8,
  padding: '0.6rem 0.8rem',
}

const controlLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
  borderRadius: 4,
  padding: '0.25rem 0.5rem',
  fontSize: '0.82rem',
  color: 'inherit',
  minWidth: 320,
  fontFamily: 'inherit',
}

const CONSUMER_SOURCE = `import { DevBanner } from '@agentic-toolkit/controls/dev-banner'
import '@agentic-toolkit/controls/dev-banner/styles.css'

// Pinned to the top of the viewport on every page (default):
<DevBanner />

// Custom message:
<DevBanner message="Beta — feedback welcome" />

// Embedded inline (e.g. inside a hero):
<DevBanner position="static" />`

const STYLES_SOURCE = `.awt-dev-banner {
  background: rgba(12, 12, 15, 0.4);
  color: #c4a35a;
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  padding: 0.5rem 1rem;
  text-transform: uppercase;
  border: 2px solid #c4a35a;
  border-radius: 6px;
  box-shadow:
    0 0 14px rgba(196, 163, 90, 0.55),
    0 0 40px rgba(196, 163, 90, 0.3);
  pointer-events: none;
  white-space: nowrap;
}

.awt-dev-banner--fixed {
  position: fixed;
  top: 3.25rem;
  left: 50%;
  transform: translateX(-50%) rotate(-8deg);
  transform-origin: center;
  z-index: 100;
}

.awt-dev-banner--static {
  display: inline-block;
  transform: rotate(-8deg);
  transform-origin: center;
}`
