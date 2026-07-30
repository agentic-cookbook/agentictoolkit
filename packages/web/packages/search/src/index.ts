/**
 * @agentic-toolkit/search — public API barrel.
 *
 * A reusable, configurable document-search view. Two seams: the SCOPE/source
 * ({@link SearchSource}, injected) and the DOCUMENT-TYPE config
 * ({@link DocumentTypeConfig} / {@link DOCUMENT_SEARCH_REGISTRY}, markdown today).
 *
 * Import the compiled, self-contained stylesheet once per host app:
 *   import '@agentic-toolkit/search/styles'
 */

// Core view
export { SearchView } from './components/SearchView'
export type { SearchViewProps } from './components/SearchView'

// Configurable seams — types
export type {
  SearchSource,
  SearchSourceEndpoints,
  SearchQueryParamMap,
  SearchFilters,
  DocumentType,
  DocumentTypeConfig,
  DocumentSearchRegistry,
  DocumentResultProps,
  DocumentPreviewProps,
  DocumentPreviewHeaderProps,
} from './types'
export { DEFAULT_QUERY_PARAMS } from './types'

// Data layer (exported for advanced composition / testing)
export {
  useDocumentSearch,
  useFacets,
  buildSearchUrl,
  buildFacetUrl,
  isActiveSearch,
  DEFAULT_PAGE_SIZE,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_TIMEOUT_MS,
} from './data/useDocumentSearch'
export type {
  DocumentSearchState,
  SearchResultEnvelope,
  SearchPhase,
  UseDocumentSearchOptions,
} from './data/useDocumentSearch'

// URL state persistence (framework-agnostic, SSR-safe) + its pure helpers
export { useUrlFilters, filtersFromSearch, filtersToSearch } from './data/useUrlFilters'

// Markdown document type — the single registered type today
export {
  markdownDocumentType,
  DOCUMENT_SEARCH_REGISTRY,
} from './registry/markdown'
export type { PaperSearchHit, PaperKind } from './registry/markdown'

// Per-kind renderer seam (c16): register a future kind's row/preview presentation
// (badge + accent, row snippet source, optional extra preview section) with no core edit.
export {
  kindRendererFor,
  registerKindRenderer,
  DEFAULT_KIND_RENDERER,
} from './registry/kinds'
export type { KindRenderer, KindBadge } from './registry/kinds'

// Markdown renderers (exported for host-app composition if needed)
export { MarkdownResultRow } from './components/markdown/MarkdownResultRow'
export { MarkdownPreview } from './components/markdown/MarkdownPreview'
export { MarkdownPreviewHeader } from './components/markdown/MarkdownPreviewHeader'
