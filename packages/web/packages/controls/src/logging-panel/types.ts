/**
 * Semantic colour buckets that map to theme tokens. Consumers reach for
 * these instead of raw colours so the panel restyles when the theme
 * changes.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug' | 'dim' | 'accent'

/**
 * One cell's rendered value. A bare string is shorthand for
 * `{ text: 'value' }`. Use the object form to attach colour / styling
 * hints — these are intentionally limited (the macOS analogue is
 * NSAttributedString, but for the web we only need the cases that
 * actually show up: coloured event types, mono timestamps, link-style
 * row ids).
 */
export type LogCellValue =
  | string
  | {
      text: string
      /** Map to a theme token. Wins over `color` when both are set. */
      level?: LogLevel
      /** Raw CSS colour (escape hatch). Use `level` first when possible. */
      color?: string
      /** Render in the monospace font. */
      mono?: boolean
      /** Render bolder than normal cell text. */
      strong?: boolean
      /** Render as link-styled text. The column's `onCellClick` handles activation. */
      link?: boolean
    }

export type LogColumnAlign = 'start' | 'center' | 'end'

export type LogColumn<TContext = unknown> = {
  id: string
  title: string
  /**
   * CSS grid track size. Number → pixels; string → any valid track size
   * (`'1fr'`, `'minmax(120px, 1fr)'`). Defaults to `'minmax(120px, 1fr)'`.
   */
  width?: number | string
  align?: LogColumnAlign
  /** Cosmetic — hints the column is interactive (cursor, underline). */
  isClickable?: boolean
  /** Default colour for cells in this column. Cells override per-cell. */
  defaultLevel?: LogLevel
  /** Default mono on cells in this column. */
  defaultMono?: boolean
  onCellClick?: (line: LogLine<TContext>) => void
  onCellDoubleClick?: (line: LogLine<TContext>) => void
}

export type LogLine<TContext = unknown> = {
  id: string
  /** Cell values keyed by `LogColumn.id`. Missing cells render empty. */
  values: Record<string, LogCellValue | undefined>
  /** Opaque payload the producer attaches — passed back to click hooks. */
  context?: TContext
}

export type LogPanelProps<TContext = unknown> = {
  columns: LogColumn<TContext>[]
  lines: LogLine<TContext>[]
  /** When true, scroll new rows into view if already pinned to the bottom. */
  followTail?: boolean
  /** Cap the rendered count to the most recent N lines. */
  maxLines?: number
  /** Shown when `lines` is empty. Defaults to "(no events)". */
  emptyMessage?: React.ReactNode
  /** Header row visibility. Default `true`. */
  showHeader?: boolean
  /** Extra class names on the root. */
  className?: string
  /** Cap the visible height; long streams scroll. */
  maxHeight?: number | string
}
