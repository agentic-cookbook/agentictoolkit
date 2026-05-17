'use client'

import { useState } from 'react'
import { ExamplePanel } from '../../ExamplePanel'
import { SourceCodePanel } from '@agentic-web-toolkit/controls/source-code-panel'
import '@agentic-web-toolkit/controls/source-code-panel/styles.css'

export const meta = { id: 'source-code-panel', label: 'Source Code Panel' }

const SAMPLES = {
  tsx: `import { useState } from 'react'

export function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start)
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Clicked {count} {count === 1 ? 'time' : 'times'}
    </button>
  )
}`,
  json: `{
  "name": "@agentic-cookbook/agentic-web-toolkit",
  "version": "0.1.0",
  "exports": {
    "./source-code-panel": "./packages/source-code-panel/index.ts"
  }
}`,
  bash: `# Build, test, push.
npm install
npm run test -- --run packages/source-code-panel
git push origin feat-filtered-list`,
  css: `.scp-root {
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  background: var(--color-surface-raised, #fff);
}`,
  swift: `import Foundation

@MainActor
public struct LogColumn: Identifiable {
    public let id: String
    public let title: String
    public let onClick: ((LogLine) -> Void)?

    public init(id: String, title: String, onClick: ((LogLine) -> Void)? = nil) {
        self.id = id
        self.title = title
        self.onClick = onClick
    }
}`,
  'objective-c': `#import <Foundation/Foundation.h>

@interface LogLine : NSObject
@property (nonatomic, readonly, copy) NSString *identifier;
@property (nonatomic, readonly, copy) NSDictionary<NSString *, id> *values;
- (instancetype)initWithIdentifier:(NSString *)identifier
                            values:(NSDictionary<NSString *, id> *)values;
@end`,
  sql: `-- Find recent ERROR events grouped by session.
select s.id           as session_id,
       count(*)       as error_count,
       max(e.created) as last_seen
from   events e
join   sessions s on s.id = e.session_id
where  e.kind = 'ERROR'
   and e.created > now() - interval '24 hours'
group  by s.id
order  by last_seen desc
limit  20;`,
} as const

type LangKey = keyof typeof SAMPLES

const LANGS: { id: LangKey; label: string }[] = [
  { id: 'tsx', label: 'TSX' },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash' },
  { id: 'css', label: 'CSS' },
  { id: 'swift', label: 'Swift' },
  { id: 'objective-c', label: 'Obj-C' },
  { id: 'sql', label: 'SQL' },
]

export default function SourceCodePanelExample() {
  const [lang, setLang] = useState<LangKey>('tsx')

  return (
    <ExamplePanel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <header>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Source Code Panel</h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Thin glue around <a href="https://shiki.style" target="_blank" rel="noreferrer">Shiki</a> (MIT) — the
            same TextMate-grammar engine VS Code uses. The panel chrome themes via toolkit CSS tokens; the
            Shiki theme follows the active global theme via the <code>--scp-shiki-theme</code> variable each
            toolkit theme declares. Switch themes from the rail to see the code re-highlight.
          </p>
        </header>

        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
            borderRadius: 8,
            padding: '0.6rem 0.8rem',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Language:</span>
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              style={{
                appearance: 'none',
                background: l.id === lang ? 'var(--color-accent-dim)' : 'transparent',
                border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
                borderRadius: 4,
                padding: '0.2rem 0.55rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              {l.label}
            </button>
          ))}
        </section>

        <SourceCodePanel
          filename={`example.${lang === 'objective-c' ? 'm' : lang}`}
          lang={lang}
          code={SAMPLES[lang]}
          maxHeight={420}
        />

        <section>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>How the consumer wires it up</h2>
          <SourceCodePanel
            filename="usage.tsx"
            lang="tsx"
            code={`import { SourceCodePanel } from '@agentic-web-toolkit/controls/source-code-panel'
import '@agentic-web-toolkit/controls/source-code-panel/styles.css'

<SourceCodePanel
  filename="example.tsx"
  lang="tsx"
  code={\`export function hello() {
  return 'world'
}\`}
/>`}
          />
        </section>
      </div>
    </ExamplePanel>
  )
}
