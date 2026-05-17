# `@agentic-cookbook/agentic-web-toolkit/logging-panel`

A configurable, themeable log/event panel — a web port of the
`LogView` / `LogColumn` / `LogLine` model from the macOS AgenticToolkit.
Configure columns when you instantiate the panel; the panel renders rows
using cell values keyed by column id.

## Why a package

Most toolkit examples and consumer apps want the same shape: a stream of
structured events (timestamp, kind, message, ids) with type-coloured
cells and optional links to a detail view. Centralising the layout +
theming + click-routing keeps consumers to a configuration object.

## Usage

```tsx
import { LogPanel } from '@agentic-cookbook/agentic-web-toolkit/logging-panel'
import '@agentic-cookbook/agentic-web-toolkit/logging-panel/styles/logging-panel.css'

type Ctx = { sessionId: string }

const columns = [
  { id: 'time', title: 'Time', width: 90, defaultMono: true, defaultLevel: 'dim' },
  { id: 'kind', title: 'Kind', width: 90 },
  { id: 'session', title: 'Session', width: 110, isClickable: true,
    onCellClick: (line) => openSession(line.context!.sessionId) },
  { id: 'message', title: 'Message' /* fills remaining track */ },
] satisfies LogColumn<Ctx>[]

<LogPanel<Ctx>
  columns={columns}
  lines={lines}
  followTail
  maxLines={500}
/>
```

A line:

```ts
{
  id: 'evt-42',
  context: { sessionId: 'sess-9' },
  values: {
    time:    '12:04:31',
    kind:    { text: 'ERROR', level: 'error', strong: true },
    session: { text: 'sess-9', link: true, level: 'accent' },
    message: 'connection reset',
  },
}
```

## Cell values

A bare string is shorthand for `{ text }`. The object form supports:

- `level: 'info' | 'warn' | 'error' | 'success' | 'debug' | 'dim' | 'accent'`
  — maps to a theme token (overridable via `--lp-color-<level>` CSS vars).
- `color: string` — raw CSS colour escape hatch (use `level` first).
- `mono: boolean` — render in the monospace font.
- `strong: boolean` — heavier weight (good for severity badges).
- `link: boolean` — render link-styled. The column's `onCellClick`
  handles activation; link styling is a cosmetic hint.

Column-level defaults (`defaultLevel`, `defaultMono`) apply unless a
cell overrides them.

## Columns

```ts
type LogColumn<TContext> = {
  id: string
  title: string
  width?: number | string  // px or any CSS grid track size
  align?: 'start' | 'center' | 'end'
  isClickable?: boolean    // cosmetic — pointer cursor on cells
  defaultLevel?: LogLevel
  defaultMono?: boolean
  onCellClick?: (line: LogLine<TContext>) => void
  onCellDoubleClick?: (line: LogLine<TContext>) => void
}
```

The cell at `(line, column)` is `line.values[column.id]`. Cells for
unknown column ids render empty (matches the macOS contract).

## Auto-scroll

`followTail` (default `true`) keeps newly-appended rows visible while the
user is pinned to the bottom. Scrolling up pauses the follow; scrolling
back to the bottom resumes it.

## Theming

Driven by CSS custom properties from
`@agentic-cookbook/agentic-web-toolkit/themes`. Level colours can be
overridden globally:

```css
:root {
  --lp-color-error: #ff5d5d;
  --lp-color-warn:  #f1b04a;
}
```

Override `.lp-root`, `.lp-header`, `.lp-row`, `.lp-cell` for
component-level customisation.
