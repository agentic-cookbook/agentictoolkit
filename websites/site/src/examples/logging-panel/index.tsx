'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExamplePanel } from '../../ExamplePanel'
import { LogPanel } from '@agentic-web-toolkit/controls/logging-panel'
import type { LogColumn, LogLevel, LogLine } from '@agentic-web-toolkit/controls/logging-panel'
import '@agentic-web-toolkit/controls/logging-panel/styles.css'
import { SourceCodePanel } from '@agentic-web-toolkit/controls/source-code-panel'
import '@agentic-web-toolkit/controls/source-code-panel/styles.css'

export const meta = { id: 'logging-panel', label: 'Logging Panel' }

type Ctx = { sessionId: string; raw: string }

const KINDS: { kind: string; level: LogLevel; messages: string[] }[] = [
  {
    kind: 'INFO',
    level: 'info',
    messages: [
      'Worker connected',
      'Cache warm: 1284 entries',
      'Heartbeat received',
      'Subscribed to channel: events.live',
    ],
  },
  {
    kind: 'WARN',
    level: 'warn',
    messages: [
      'Slow query detected (812 ms)',
      'Retrying upstream request',
      'Rate-limit window 80% used',
    ],
  },
  {
    kind: 'ERROR',
    level: 'error',
    messages: [
      'Upstream 502 — gateway',
      'Token decode failed',
      'Connection reset by peer',
    ],
  },
  {
    kind: 'OK',
    level: 'success',
    messages: ['Job completed', 'Migration applied', 'Backup verified'],
  },
  {
    kind: 'DEBUG',
    level: 'debug',
    messages: ['Trace span emit', 'TLS handshake', 'Plan resolved in 12 ms'],
  },
]

let nextLineId = 1
let nextSessionId = 1000

function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function makeLine(): LogLine<Ctx> {
  const bucket = KINDS[Math.floor(Math.random() * KINDS.length)]
  const message = bucket.messages[Math.floor(Math.random() * bucket.messages.length)]
  const sessionId = `sess-${++nextSessionId}`
  return {
    id: `evt-${nextLineId++}`,
    context: { sessionId, raw: `${bucket.kind}: ${message}` },
    values: {
      time: { text: fmtTime(new Date()), mono: true, level: 'dim' },
      kind: { text: bucket.kind, level: bucket.level, strong: true, mono: true },
      session: { text: sessionId, mono: true, link: true, level: 'accent' },
      message,
    },
  }
}

export default function LoggingPanelExample() {
  const [lines, setLines] = useState<LogLine<Ctx>[]>(() =>
    Array.from({ length: 6 }, () => makeLine()),
  )
  const [running, setRunning] = useState(true)
  const [followTail, setFollowTail] = useState(true)
  const [selected, setSelected] = useState<LogLine<Ctx> | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    const tick = () => {
      setLines((prev) => [...prev, makeLine()].slice(-500))
      timerRef.current = window.setTimeout(tick, 600 + Math.random() * 900)
    }
    timerRef.current = window.setTimeout(tick, 700)
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [running])

  const columns = useMemo<LogColumn<Ctx>[]>(
    () => [
      { id: 'time', title: 'Time', width: 120, defaultMono: true },
      { id: 'kind', title: 'Kind', width: 90, align: 'start' },
      {
        id: 'session',
        title: 'Session',
        width: 110,
        isClickable: true,
        onCellClick: (line) => setSelected(line),
      },
      { id: 'message', title: 'Message', width: 'minmax(200px, 1fr)' },
    ],
    [],
  )

  return (
    <ExamplePanel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Logging Panel</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            A configurable log/event panel — the consumer declares columns up front (id, title, width,
            colour defaults, click hooks) and feeds lines whose <code>values</code> are keyed by column id.
            Cells can carry a <code>level</code> for theme-token colouring or a <code>link</code> flag to
            trigger the column&rsquo;s <code>onCellClick</code>. Auto-scrolls while the user is pinned to
            the bottom.
          </p>
        </header>

        <section
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
            borderRadius: 8,
            padding: '0.6rem 0.8rem',
          }}
        >
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            style={controlButtonStyle(running)}
          >
            {running ? 'Pause stream' : 'Resume stream'}
          </button>
          <button
            type="button"
            onClick={() => setFollowTail((f) => !f)}
            style={controlButtonStyle(followTail)}
          >
            Follow tail: {followTail ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => setLines([])}
            style={controlButtonStyle(false)}
          >
            Clear
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {lines.length} line{lines.length === 1 ? '' : 's'}
          </span>
        </section>

        <LogPanel<Ctx>
          columns={columns}
          lines={lines}
          followTail={followTail}
          maxLines={500}
          maxHeight={360}
          emptyMessage="(stream paused — press Resume to start)"
        />

        <section
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
            borderRadius: 8,
            padding: '0.9rem 1rem',
            minHeight: 80,
          }}
        >
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem' }}>Detail panel</h2>
          {selected ? (
            <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div>
                <strong>Session:</strong>{' '}
                <code>{selected.context?.sessionId}</code>
              </div>
              <div>
                <strong>Event id:</strong> <code>{selected.id}</code>
              </div>
              <div>
                <strong>Raw:</strong> <code>{selected.context?.raw}</code>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                (Clicked the link-styled <em>Session</em> cell — the column&rsquo;s <code>onCellClick</code>{' '}
                fires with the full <code>LogLine</code>.)
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
              Click a session id in the panel to surface it here.
            </div>
          )}
        </section>

        <section>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>How the consumer wires it up</h2>
          <SourceCodePanel filename="usage.tsx" lang="tsx" code={CONSUMER_SOURCE} />
        </section>
      </div>
    </ExamplePanel>
  )
}

function controlButtonStyle(active: boolean): React.CSSProperties {
  return {
    appearance: 'none',
    background: active ? 'var(--color-accent-dim)' : 'transparent',
    border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
    borderRadius: 4,
    padding: '0.25rem 0.6rem',
    fontSize: '0.78rem',
    cursor: 'pointer',
    color: 'inherit',
  }
}

const CONSUMER_SOURCE = `import { LogPanel } from '@agentic-web-toolkit/controls/logging-panel'
import type { LogColumn, LogLine } from '@agentic-web-toolkit/controls/logging-panel'
import '@agentic-web-toolkit/controls/logging-panel/styles.css'

type Ctx = { sessionId: string }

const columns: LogColumn<Ctx>[] = [
  { id: 'time',    title: 'Time',    width: 120, defaultMono: true },
  { id: 'kind',    title: 'Kind',    width: 90 },
  { id: 'session', title: 'Session', width: 110, isClickable: true,
    onCellClick: (line) => openSession(line.context!.sessionId) },
  { id: 'message', title: 'Message', width: 'minmax(200px, 1fr)' },
]

const lines: LogLine<Ctx>[] = [
  {
    id: 'evt-1',
    context: { sessionId: 'sess-9' },
    values: {
      time:    { text: '12:04:31.044', mono: true, level: 'dim' },
      kind:    { text: 'ERROR',         level: 'error', strong: true, mono: true },
      session: { text: 'sess-9',        link: true,    level: 'accent', mono: true },
      message: 'connection reset by peer',
    },
  },
  // …more lines
]

<LogPanel<Ctx>
  columns={columns}
  lines={lines}
  followTail
  maxLines={500}
  maxHeight={360}
/>`
