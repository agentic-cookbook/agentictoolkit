'use client'

import { useMemo, useState } from 'react'
import { ExamplePanel } from '../../ExamplePanel'
import { FilteredList } from '@agentic-web-toolkit/controls/filtered-list'
import '@agentic-web-toolkit/controls/filtered-list/styles.css'
import { LogPanel } from '@agentic-web-toolkit/controls/logging-panel'
import type { LogColumn, LogLevel, LogLine } from '@agentic-web-toolkit/controls/logging-panel'
import '@agentic-web-toolkit/controls/logging-panel/styles.css'
import { SourceCodePanel } from '@agentic-web-toolkit/controls/source-code-panel'
import '@agentic-web-toolkit/controls/source-code-panel/styles.css'

export const meta = { id: 'filtered-list', label: 'Filtered List' }

type Service = {
  id: string
  name: string
  providerKind: 'openai' | 'anthropic' | 'gemini'
  baseUrl: string
}

const services: Service[] = [
  { id: '1', name: 'Groq', providerKind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: '2', name: 'OpenAI', providerKind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  { id: '3', name: 'Together', providerKind: 'openai', baseUrl: 'https://api.together.xyz/v1' },
  { id: '4', name: 'Fireworks', providerKind: 'openai', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { id: '5', name: 'Cerebras', providerKind: 'openai', baseUrl: 'https://api.cerebras.ai/v1' },
  { id: '6', name: 'DeepSeek', providerKind: 'openai', baseUrl: 'https://api.deepseek.com/v1' },
  { id: '7', name: 'Mistral', providerKind: 'openai', baseUrl: 'https://api.mistral.ai/v1' },
  { id: '8', name: 'xAI', providerKind: 'openai', baseUrl: 'https://api.x.ai/v1' },
  { id: '9', name: 'OpenRouter', providerKind: 'openai', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: '10', name: 'Ollama (local)', providerKind: 'openai', baseUrl: 'http://localhost:11434/v1' },
  { id: '11', name: 'Anthropic', providerKind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { id: '12', name: 'Gemini', providerKind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
]

const CONSUMER_SOURCE = `const services: Service[] = [
  { id: '1', name: 'Groq',   providerKind: 'openai', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: '2', name: 'OpenAI', providerKind: 'openai', baseUrl: 'https://api.openai.com/v1' },
  // …more rows
]

<FilteredList<Service>
  items={services}
  getId={(s) => s.id}
  getTitle={(s) => s.name}
  getSubtitle={(s) => s.providerKind}
  getDetails={(s) => s.baseUrl}
  placeholder="Filter by name, provider, or URL…"
  autoFocus
  onSelect={(s) => log({ type: 'select', item: s })}
  onHighlightChange={(s) => log({ type: 'highlight', item: s })}
/>`

type EventType = 'select' | 'highlight' | 'highlight-clear'
type EventCtx = { type: EventType; service: Service | null }

const TYPE_LEVEL: Record<EventType, LogLevel> = {
  select: 'success',
  highlight: 'accent',
  'highlight-clear': 'dim',
}

let nextEventId = 1

function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function FilteredListExample() {
  const [picked, setPicked] = useState<Service | null>(null)
  const [events, setEvents] = useState<LogLine<EventCtx>[]>([])

  function pushEvent(type: EventType, service: Service | null, text: string) {
    const line: LogLine<EventCtx> = {
      id: `evt-${nextEventId++}`,
      context: { type, service },
      values: {
        time: { text: fmtTime(new Date()), mono: true, level: 'dim' },
        type: { text: type, level: TYPE_LEVEL[type], strong: true, mono: true },
        text,
      },
    }
    setEvents((prev) => [...prev, line].slice(-50))
  }

  const columns = useMemo<LogColumn<EventCtx>[]>(
    () => [
      { id: 'time', title: 'Time', width: 80, defaultMono: true },
      { id: 'type', title: 'Type', width: 110 },
      { id: 'text', title: 'Detail', width: 'minmax(120px, 1fr)' },
    ],
    [],
  )

  return (
    <ExamplePanel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1.5rem',
        }}
      >
        <header style={{ gridColumn: '1 / -1' }}>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Filtered List</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Type to filter. <kbd>↓</kbd> moves focus into the list, <kbd>↑</kbd>/<kbd>↓</kbd> navigate,
            and <kbd>Enter</kbd> selects. The highlighted item&rsquo;s title fills the input as you move.
            Theme switches in the rail re-skin the list (and the code panel below) via CSS tokens.
          </p>
        </header>

        <section
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
            borderRadius: 8,
            padding: '1rem',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Pick a service</h2>
          <FilteredList<Service>
            items={services}
            getId={(s) => s.id}
            getTitle={(s) => s.name}
            getSubtitle={(s) => s.providerKind}
            getDetails={(s) => s.baseUrl}
            placeholder="Filter by name, provider, or URL…"
            autoFocus
            onSelect={(s) => {
              setPicked(s)
              pushEvent('select', s, `${s.name} — ${s.baseUrl}`)
            }}
            onHighlightChange={(s) => {
              if (s) pushEvent('highlight', s, s.name)
              else pushEvent('highlight-clear', null, '(cleared)')
            }}
          />
        </section>

        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minHeight: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '0.95rem' }}>Consumer events</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {picked ? (
              <>
                Last selected: <strong>{picked.name}</strong> — <code>{picked.baseUrl}</code>
              </>
            ) : (
              <>Move with arrow keys, press Enter to select.</>
            )}
          </div>
          <LogPanel<EventCtx>
            columns={columns}
            lines={events}
            followTail
            maxLines={50}
            maxHeight={260}
            emptyMessage="(no events yet)"
          />
        </section>

        <section style={{ gridColumn: '1 / -1' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>How the consumer wires it up</h2>
          <SourceCodePanel filename="usage.tsx" lang="tsx" code={CONSUMER_SOURCE} />
        </section>
      </div>
    </ExamplePanel>
  )
}
