'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExamplePanel } from '../../src/ExamplePanel'
import {
  InlineChatView,
  MockBackend,
  useChatSession,
} from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/base.css'
import '@agentic-toolkit/chat/css/modes/inline.css'
import { SourceCodePanel } from '@agentic-toolkit/controls/source-code-panel'
import '@agentic-toolkit/controls/source-code-panel/styles.css'
import {
  themes,
  themeIds,
  type ThemeKey,
} from '@agentic-toolkit/themes'
import './index.css'

export const meta = { id: 'theme', label: 'Theme' }

const STORAGE_THEME = 'awt-site:theme'
const DEFAULT_THEME: ThemeKey = 'agenticcookbookweb'

function readTheme(): ThemeKey {
  try {
    const v = window.localStorage.getItem(STORAGE_THEME)
    if (v && (themeIds as string[]).includes(v)) return v as ThemeKey
  } catch {
    // ignore
  }
  return DEFAULT_THEME
}

function useActiveTheme(): ThemeKey {
  const [theme, setTheme] = useState<ThemeKey>(readTheme)
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ThemeKey>).detail
      if (detail && (themeIds as string[]).includes(detail)) setTheme(detail)
    }
    window.addEventListener('awt-site:theme', onChange)
    return () => window.removeEventListener('awt-site:theme', onChange)
  }, [])
  return theme
}

const SITE_TOKENS = [
  '--color-surface',
  '--color-surface-raised',
  '--color-surface-hover',
  '--color-border',
  '--color-border-subtle',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-dim',
  '--color-accent',
  '--color-accent-dim',
  '--color-success',
  '--color-error',
  '--color-info',
]

const CHAT_TOKENS = [
  '--pc-surface',
  '--pc-persona-bg',
  '--pc-persona-border',
  '--pc-persona-text',
  '--pc-persona-name',
  '--pc-user-bg',
  '--pc-user-border',
  '--pc-user-text',
  '--pc-user-name',
  '--pc-input-bg',
  '--pc-input-border',
  '--pc-input-focus',
  '--pc-send-bg',
  '--pc-send-text',
  '--pc-time-color',
]

function Swatch({ token }: { token: string }) {
  return (
    <div className="awt-swatch">
      <div className="awt-swatch-chip" style={{ background: `var(${token})` }} />
      <code>{token}</code>
    </div>
  )
}

function PaletteGrid({ tokens, title }: { tokens: string[]; title: string }) {
  return (
    <div>
      <h3 className="awt-subhead">{title}</h3>
      <div className="awt-swatch-grid">
        {tokens.map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </div>
    </div>
  )
}

const SAMPLE_BACKEND = new MockBackend()
const SAMPLE_PERSONA = { name: 'Claire', avatar: 'C' }

function ChatSample() {
  const session = useChatSession({
    persona: SAMPLE_PERSONA,
    backend: SAMPLE_BACKEND,
    welcomeMessage:
      "Hello! I'm a sample chat — useful for previewing chat surface tokens.",
  })
  useEffect(() => {
    session.sendMessage('How does this theme look in dark mode?')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="awt-chat-sample">
      <InlineChatView session={session} sizing={{ mode: 'fixed' }} />
    </div>
  )
}

interface Example {
  label: string
  demo: ReactNode
  css: string
}

function ExampleCard({ example }: { example: Example }) {
  return (
    <article className="awt-theme-card">
      <h3 className="awt-theme-card-label">{example.label}</h3>
      <div className="awt-theme-card-grid">
        <div className="awt-theme-card-demo">{example.demo}</div>
        <div className="awt-theme-card-css">
          <SourceCodePanel
            code={example.css}
            lang="css"
            filename="theme.css"
            showCopy={true}
          />
        </div>
      </div>
    </article>
  )
}

function ExampleList({ examples }: { examples: Example[] }) {
  return (
    <div className="awt-theme-card-stack">
      {examples.map((ex) => (
        <ExampleCard key={ex.label} example={ex} />
      ))}
    </div>
  )
}

const SWATCH_CSS = `.awt-swatch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  background: var(--color-surface-raised);
}
.awt-swatch-chip {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--color-border-subtle);
  /* per-swatch: background: var(<token>); */
}
.awt-swatch code {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-secondary);
}`

const HEADINGS_CSS = `.awt-typography h1 {
  font-family: var(--font-display);
  font-size: 2rem;
  margin: 0 0 0.5rem;
}
.awt-typography h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  margin: 1.25rem 0 0.4rem;
}
.awt-typography h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1rem 0 0.3rem;
}
.awt-typography h4 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0.75rem 0 0.25rem;
  color: var(--color-text-secondary);
}`

const BODY_TEXT_CSS = `.awt-typography p {
  max-width: 70ch;
  margin: 0 0 0.75rem;
}
.awt-typography a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.awt-typography code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--color-surface-raised);
  padding: 0.1em 0.3em;
  border: 1px solid var(--color-border-subtle);
  border-radius: 3px;
}
.awt-small-caps {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-dim);
}`

const BLOCKQUOTE_CSS = `.awt-typography blockquote {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  color: var(--color-text-secondary);
  border-left: 2px solid var(--color-accent);
  font-style: italic;
}
.awt-typography pre {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  padding: 0.75rem 1rem;
}`

const PROSE_CSS = `/* The .prose class is supplied by @tailwindcss/typography.
   Each theme overrides the --tw-prose-* variables so prose
   articles inherit theme colors automatically. */

.prose {
  --tw-prose-body: var(--color-text-primary);
  --tw-prose-headings: var(--color-text-primary);
  --tw-prose-links: var(--color-accent);
  --tw-prose-quotes: var(--color-text-secondary);
  --tw-prose-code: var(--color-text-primary);
  /* …and more, set per theme. */
}`

const SURFACES_CSS = `.awt-card {
  padding: 1rem;
  border-radius: 8px;
}
.awt-surface {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.awt-raised {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  margin-top: 0.75rem;
}
.awt-hover {
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border-subtle);
  margin-top: 0.75rem;
}
.awt-card-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.75rem 0;
}
.awt-divider-subtle {
  background: var(--color-border-subtle);
}`

const BUTTONS_CSS = `.awt-btn {
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.4rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}
.awt-btn-primary {
  background: var(--color-accent);
  color: var(--color-surface);
  border-color: var(--color-accent);
}
.awt-btn-secondary {
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
.awt-btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}`

const INPUTS_CSS = `.awt-controls input[type="text"] {
  font-family: inherit;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}
.awt-controls input[type="text"]:focus {
  border-color: var(--color-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent-dim);
}`

const STATUS_CSS = `.awt-status {
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
  font-size: 0.85rem;
  border: 1px solid;
}
.awt-status-success {
  color: var(--color-success);
  border-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}
.awt-status-error {
  color: var(--color-error);
  border-color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
}
.awt-status-info {
  color: var(--color-info);
  border-color: var(--color-info);
  background: color-mix(in srgb, var(--color-info) 12%, transparent);
}`

const MOTION_CSS = `.awt-fade-loop {
  padding: 0.6rem 1rem;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  width: fit-content;
  animation: awt-fade-loop 2.5s ease-in-out infinite;
}
@keyframes awt-fade-loop {
  0%, 100% { opacity: 1; transform: translateY(0); }
  50%      { opacity: 0.3; transform: translateY(-3px); }
}

.awt-dots-loop span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: awt-dots-pulse 1.4s ease-in-out infinite;
}
@keyframes awt-dots-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}`

const ELEVATION_CSS = `.awt-elevation-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 1rem 1.25rem;
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-text-primary) 25%, transparent);
}`

const CHROME_CSS = `.awt-chrome-scroll {
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
}
.awt-chrome-caret {
  font-family: inherit;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
}
/* ::selection styling is theme-defined via the global theme CSS. */`

const CHAT_CSS = `/* Chat surface tokens — set per theme:
   --pc-surface, --pc-persona-bg, --pc-persona-border, --pc-persona-text,
   --pc-persona-name, --pc-user-bg, --pc-user-border, --pc-user-text,
   --pc-user-name, --pc-input-bg, --pc-input-border, --pc-input-focus,
   --pc-send-bg, --pc-send-text, --pc-time-color */`

interface Topic {
  id: string
  label: string
  description?: string
  render: (ctx: { activeTheme: ThemeKey }) => ReactNode
}

const TOPICS: Topic[] = [
  {
    id: 'css',
    label: 'CSS',
    description: 'The full CSS source for the active theme variant.',
    render: ({ activeTheme }) => {
      const css = themes[activeTheme].css
      return (
        <div className="awt-theme-css">
          <p className="awt-theme-css-note">
            Source CSS for the active theme variant:{' '}
            <strong>{themes[activeTheme].label}</strong>. Switch the variant
            from the rail's Themes section to see this update.
          </p>
          <SourceCodePanel
            code={css}
            lang="css"
            filename={`${activeTheme}.css`}
          />
        </div>
      )
    },
  },
  {
    id: 'palette',
    label: 'Color palette',
    description: 'Every color token in the active theme.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Site tokens',
            demo: <PaletteGrid tokens={SITE_TOKENS} title="Site" />,
            css: SWATCH_CSS,
          },
          {
            label: 'Chat tokens',
            demo: <PaletteGrid tokens={CHAT_TOKENS} title="Chat" />,
            css: SWATCH_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'typography',
    label: 'Typography',
    description: 'Display, sans, and mono fonts — sizes, weights, decorations.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Headings',
            demo: (
              <div className="awt-typography">
                <h1>The quick brown fox jumps over the lazy dog</h1>
                <h2>Heading 2 — section divider</h2>
                <h3>Heading 3 — sub-section</h3>
                <h4>Heading 4 — minor heading</h4>
              </div>
            ),
            css: HEADINGS_CSS,
          },
          {
            label: 'Body text',
            demo: (
              <div className="awt-typography">
                <p>
                  Body paragraph using the theme's sans font.{' '}
                  <a href="#">Inline link</a> and <code>inline code</code> for
                  monospaced fragments.
                </p>
                <p className="awt-small-caps">Small caps eyebrow label</p>
              </div>
            ),
            css: BODY_TEXT_CSS,
          },
          {
            label: 'Blockquote & code block',
            demo: (
              <div className="awt-typography">
                <blockquote>
                  Blockquote using the theme's quote treatment — typically a
                  quieter color and a left border.
                </blockquote>
                <pre>
                  <code>{`function example(theme: ThemeKey) {\n  return themes[theme].css\n}`}</code>
                </pre>
              </div>
            ),
            css: BLOCKQUOTE_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'prose',
    label: 'Prose article',
    description: 'Markdown-style content via the .prose class.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Prose article',
            demo: (
              <article className="prose">
                <h1>Sample article</h1>
                <p>
                  This block uses the <code>.prose</code> class so each theme's{' '}
                  <code>--tw-prose-*</code> overrides take effect.
                </p>
                <h2>Lists</h2>
                <ul>
                  <li>Unordered item one</li>
                  <li>Unordered item two</li>
                </ul>
                <ol>
                  <li>Ordered item one</li>
                  <li>Ordered item two</li>
                </ol>
                <blockquote>
                  <p>"Every theme expresses itself through these primitives."</p>
                </blockquote>
              </article>
            ),
            css: PROSE_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    description: 'Surface, raised, hover layers with both border tokens.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Layered surfaces',
            demo: (
              <div className="awt-surfaces">
                <div className="awt-card awt-surface">
                  <div className="awt-card-label">surface</div>
                  <div className="awt-card awt-raised">
                    <div className="awt-card-label">surface-raised</div>
                    <div className="awt-card awt-hover">
                      <div className="awt-card-label">surface-hover</div>
                      <div className="awt-card-divider" />
                      <p>
                        Border tokens shown above (border) and below
                        (border-subtle).
                      </p>
                      <div className="awt-card-divider awt-divider-subtle" />
                    </div>
                  </div>
                </div>
              </div>
            ),
            css: SURFACES_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'controls',
    label: 'Controls',
    description: 'Buttons, inputs, checkboxes.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Buttons',
            demo: (
              <div className="awt-controls">
                <div className="awt-control-row">
                  <button className="awt-btn awt-btn-primary">Primary</button>
                  <button className="awt-btn awt-btn-secondary">
                    Secondary
                  </button>
                  <button className="awt-btn awt-btn-ghost">Ghost</button>
                </div>
              </div>
            ),
            css: BUTTONS_CSS,
          },
          {
            label: 'Inputs & checkbox',
            demo: (
              <div className="awt-controls">
                <div className="awt-control-row">
                  <input type="text" placeholder="Default input" />
                  <input
                    type="text"
                    placeholder="Focused input — click to focus"
                  />
                </div>
                <label className="awt-control-row">
                  <input type="checkbox" defaultChecked /> Checkbox
                </label>
              </div>
            ),
            css: INPUTS_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Success, error, info callouts.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Status callouts',
            demo: (
              <div className="awt-status-stack">
                <div className="awt-status awt-status-success">
                  Save succeeded — your changes are persisted.
                </div>
                <div className="awt-status awt-status-error">
                  Could not connect — retry in a few seconds.
                </div>
                <div className="awt-status awt-status-info">
                  A new version of the toolkit is available.
                </div>
              </div>
            ),
            css: STATUS_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'motion',
    label: 'Motion',
    description: 'Animations and transitions the theme defines.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Looping animations',
            demo: (
              <div className="awt-motion">
                <div className="awt-fade-loop">
                  Fade-in animation (replays every 2.5s)
                </div>
                <div className="awt-dots-loop">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="awt-motion-note">
                  Themes can disable motion entirely (e.g., terminal). If you
                  see no movement, that's intentional.
                </p>
              </div>
            ),
            css: MOTION_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'elevation',
    label: 'Elevation',
    description: 'Shadows and backdrop filters.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Elevated card',
            demo: (
              <div className="awt-elevation-stage">
                <div className="awt-elevation-bg" />
                <div className="awt-elevation-card">
                  <h3>Elevated card</h3>
                  <p>
                    Drop shadow + (when defined) backdrop-filter blur, layered
                    over a translucent surface.
                  </p>
                </div>
              </div>
            ),
            css: ELEVATION_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'chrome',
    label: 'Decorative chrome',
    description: 'Selection, scrollbar, caret.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Selection, scrollbar, caret',
            demo: (
              <div className="awt-chrome">
                <p className="awt-chrome-select">
                  Select this sentence with your cursor to see ::selection
                  styling.
                </p>
                <div className="awt-chrome-scroll">
                  <p>
                    Scrollable inner panel — drag to see the theme's scrollbar
                    treatment.
                  </p>
                  <p>Line two.</p>
                  <p>Line three.</p>
                  <p>Line four.</p>
                  <p>Line five.</p>
                  <p>Line six.</p>
                  <p>Line seven.</p>
                  <p>Line eight.</p>
                </div>
                <input
                  type="text"
                  defaultValue="Caret color appears when this input is focused"
                  className="awt-chrome-caret"
                />
              </div>
            ),
            css: CHROME_CSS,
          },
        ]}
      />
    ),
  },
  {
    id: 'chat',
    label: 'Chat sample',
    description: 'A compact chat surface using the theme.',
    render: () => (
      <ExampleList
        examples={[
          {
            label: 'Inline chat',
            demo: <ChatSample />,
            css: CHAT_CSS,
          },
        ]}
      />
    ),
  },
]

export default function ThemeExample() {
  const activeTheme = useActiveTheme()
  const [topicId, setTopicId] = useState<string>(TOPICS[0].id)
  const topic = useMemo(
    () => TOPICS.find((t) => t.id === topicId) ?? TOPICS[0],
    [topicId],
  )

  return (
    <ExamplePanel>
      <div className="awt-theme-split">
        <aside className="awt-theme-topics" aria-label="Theme topics">
        <h2 className="awt-theme-topics-heading">Topics</h2>
        <ul className="awt-theme-topics-list">
          {TOPICS.map((t) => {
            const selected = t.id === topic.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="awt-theme-topic-btn"
                  aria-pressed={selected}
                  onClick={() => setTopicId(t.id)}
                >
                  {t.label}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

        <section className="awt-theme-detail">
          <header className="awt-theme-detail-header">
            <h1>{topic.label}</h1>
            {topic.description && <p>{topic.description}</p>}
          </header>
          <div className="awt-theme-detail-body">
            {topic.render({ activeTheme })}
          </div>
        </section>
      </div>
    </ExamplePanel>
  )
}
