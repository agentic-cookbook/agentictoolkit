/**
 * @agentic-toolkit/markdown — public API barrel.
 *
 * Import the CSS separately (once per host app):
 *   import '@agentic-toolkit/markdown/styles'
 */

// Main viewer component
export { MarkdownViewer } from './components/MarkdownViewer'
export type { MarkdownViewerProps } from './components/MarkdownViewer'

// Sub-components (exported for host-app composition if needed)
export { MarkdownRenderer } from './components/MarkdownRenderer'
export type { MarkdownRendererProps } from './components/MarkdownRenderer'

// Server-rendered markdown (RSC) — SSR/crawlable, no client "Rendering…" flash. Same engine +
// CSS as MarkdownRenderer; use this in server components / prerendered docs routes.
export { MarkdownContent } from './components/MarkdownContent'
export type { MarkdownContentProps } from './components/MarkdownContent'

// The shared document EDITING view — body editor + live preview + layout choice. The default
// markdown editor for document surfaces; `@agentic-toolkit/ui`'s MarkdownEditor remains the
// bare textarea this composes.
export { MarkdownDocumentEditor, SPLIT_MIN_WIDTH } from './components/MarkdownDocumentEditor'
export type {
  MarkdownDocumentEditorProps,
  MarkdownEditorLayout,
  MarkdownEditorTab,
} from './components/MarkdownDocumentEditor'

// The reading-palette wrapper (data-mdv-theme + data-mdv-shiki-variant + the --mdv-* palette)
// applied around markdown content. NO "use client" — a plain server-safe wrapper, same as
// MarkdownContent, so an async RSC can render it. This is the package's own knowledge about
// its own palette; PaperRenderer (research site) and MarkdownPreview (search package) each
// hand-roll the same 5 lines today and are not migrated to this by this change.
export { MarkdownReadingPalette } from './components/MarkdownReadingPalette'
export type { MarkdownReadingPaletteProps } from './components/MarkdownReadingPalette'

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
