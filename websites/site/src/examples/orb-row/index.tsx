'use client'

import { useState } from 'react'
import { ExamplePanel } from '../../ExamplePanel'
import { OrbRow } from '@agentic-toolkit/controls/orb-row'
import type { OrbSite } from '@agentic-toolkit/controls/orb-row'
import '@agentic-toolkit/controls/orb-row/styles.css'
import { SourceCodePanel } from '@agentic-toolkit/controls/source-code-panel'
import '@agentic-toolkit/controls/source-code-panel/styles.css'

export const meta = { id: 'orb-row', label: 'Orb Row' }

const sites: OrbSite[] = [
  {
    id: 'cookbook',
    name: 'The Agentic Cookbook',
    emoji: '📖',
    iconGradient: 'linear-gradient(135deg,#c4a35a,#e8c547)',
    url: 'https://agenticcookbook.dev',
  },
  {
    id: 'registry',
    name: 'The Agentic Persona Registry',
    emoji: '🪪',
    iconGradient: 'linear-gradient(135deg,#5cb270,#7dd99b)',
    url: 'https://agenticpersonaregistry.com',
  },
  {
    id: 'storage',
    name: 'Persona Data Store',
    emoji: '🪣',
    iconGradient: 'linear-gradient(135deg,#6b8afd,#99b2ff)',
    url: 'https://personas.agenticdatastore.dev/',
  },
  {
    id: 'user-data',
    name: 'User Data Store',
    emoji: '👤',
    iconGradient: 'linear-gradient(135deg,#e07a82,#f5a3a8)',
    url: 'https://agenticdatastore.com',
  },
  {
    id: 'persona-toolkit',
    name: 'Agentic Persona Toolkit',
    emoji: '🧰',
    iconGradient: 'linear-gradient(135deg,#5cc4c4,#7de0e0)',
    url: 'https://agenticpersonatoolkit.dev',
  },
  {
    id: 'devteam',
    name: 'Agentic Developer Team',
    emoji: '🛠️',
    iconGradient: 'linear-gradient(135deg,#b07dd4,#d4a5f5)',
    url: 'https://agenticdevteam.com',
  },
]

const NONE = '__none__'

export default function OrbRowExample() {
  const [currentSite, setCurrentSite] = useState<string>(NONE)
  const [docked, setDocked] = useState(false)

  return (
    <ExamplePanel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Orb Row</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            A reusable orb dock that links the agentic family sites. Each orb is a gradient
            disc with a hover tooltip; the current site is marked with a gold ring, a pulse,
            and a small gold dot below. The whole row bobs gently. Pass <code>sites</code> to
            populate it, optionally a <code>currentSite</code> id to mark "you are here", and{' '}
            <code>docked</code> to pin it as a translucent pill at the bottom of the viewport.
          </p>
        </header>

        <section
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
            borderRadius: 8,
            padding: '0.6rem 0.8rem',
          }}
        >
          <label style={controlLabelStyle}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              "You are here" orb
            </span>
            <select
              value={currentSite}
              onChange={(e) => setCurrentSite(e.target.value)}
              style={selectStyle}
            >
              <option value={NONE}>(none)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ ...controlLabelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="checkbox"
              checked={docked}
              onChange={(e) => setDocked(e.target.checked)}
            />
            <span style={{ fontSize: '0.82rem' }}>Docked (fixed bottom-center)</span>
          </label>
        </section>

        <section
          style={{
            background: '#0c0c0f',
            border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
            borderRadius: 8,
            padding: docked ? '3rem 1rem 6rem' : '3rem 1rem',
            position: 'relative',
            overflow: 'hidden',
            minHeight: docked ? 220 : 140,
          }}
        >
          <OrbRow
            sites={sites}
            currentSite={currentSite === NONE ? undefined : currentSite}
            docked={docked}
          />
          {docked ? (
            <div
              style={{
                position: 'absolute',
                top: '0.6rem',
                left: '0.8rem',
                fontSize: '0.7rem',
                fontFamily: 'DM Mono, ui-monospace, monospace',
                color: '#5a5a6a',
              }}
            >
              docked: orb row is fixed to bottom of the viewport
            </div>
          ) : null}
        </section>

        <section>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>How the consumer wires it up</h2>
          <SourceCodePanel filename="usage.tsx" lang="tsx" code={CONSUMER_SOURCE} />
        </section>
      </div>
    </ExamplePanel>
  )
}

const controlLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const selectStyle: React.CSSProperties = {
  appearance: 'auto',
  background: 'transparent',
  border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
  borderRadius: 4,
  padding: '0.25rem 0.5rem',
  fontSize: '0.82rem',
  color: 'inherit',
  minWidth: 220,
}

const CONSUMER_SOURCE = `import { OrbRow } from '@agentic-toolkit/controls/orb-row'
import type { OrbSite } from '@agentic-toolkit/controls/orb-row'
import '@agentic-toolkit/controls/orb-row/styles.css'

const sites: OrbSite[] = [
  { id: 'cookbook', name: 'The Agentic Cookbook', emoji: '📖',
    iconGradient: 'linear-gradient(135deg,#c4a35a,#e8c547)',
    url: 'https://agenticcookbook.dev' },
  { id: 'registry', name: 'The Agentic Persona Registry', emoji: '🪪',
    iconGradient: 'linear-gradient(135deg,#5cb270,#7dd99b)',
    url: 'https://agenticpersonaregistry.com' },
  // …more
]

// Inline at the top of a landing page:
<OrbRow sites={sites} currentSite="registry" />

// Or docked as a fixed bottom-center pill on every page:
<OrbRow sites={sites} currentSite="registry" docked />`
