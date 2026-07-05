/**
 * @adh-shared/markdown — public API barrel.
 *
 * Import the CSS separately (once per host app):
 *   import '@adh-shared/markdown/styles'
 */

// Main viewer component
export { MarkdownViewer } from './components/MarkdownViewer'
export type { MarkdownViewerProps } from './components/MarkdownViewer'

// Sub-components (exported for host-app composition if needed)
export { MarkdownRenderer } from './components/MarkdownRenderer'
export type { MarkdownRendererProps } from './components/MarkdownRenderer'

export { MarkdownThemeSwitcher } from './components/MarkdownThemeSwitcher'
export type { MarkdownThemeSwitcherProps } from './components/MarkdownThemeSwitcher'

// Data hook + the injectable fetcher seam
export {
  useMarkdownDocument,
  defaultMarkdownFetcher,
} from './hooks/useMarkdownDocument'
export type {
  FetchState,
  MarkdownFetcher,
  UseMarkdownDocumentOptions,
} from './hooks/useMarkdownDocument'

// Theme registry + palettes (host apps may inspect or extend themes)
export {
  VIEWER_THEMES,
  VIEWER_THEME_IDS,
  DEFAULT_THEME_ID,
  getThemeById,
} from './themes/registry'
export type { ViewerTheme, MdvPalette, MdvVarName } from './themes/registry'
export { MDV_PALETTES } from './themes/palettes'

// Markdown processing utility (exported for SSR / testing use)
export { processMarkdown } from './lib/process-markdown'
export type { ProcessedMarkdown } from './lib/process-markdown'

// MarkdownDocument type (re-exported for convenience)
export type { MarkdownDocument } from './types'
