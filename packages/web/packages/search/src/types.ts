import type { ComponentType, Ref } from 'react'

/**
 * @agentic-toolkit/search — the three configurable seams.
 *
 * 1. SCOPE/SOURCE seam ({@link SearchSource}): WHERE to search — a base URL plus the
 *    endpoint paths and query-param names. The core view holds NO literal endpoint or
 *    public-only query string; the scope is injected at the call site, so the same view
 *    serves the public corpus today and a bucket-scoped corpus later with no core edit.
 *
 * 2. DOCUMENT-TYPE seam ({@link DocumentTypeConfig} / {@link DocumentSearchRegistry}):
 *    HOW a result of a given type renders — its result-row and preview renderers, plus
 *    id and title derivation. Markdown is the single entry today; a future type is added
 *    by registering another config, never by editing the core view (open/closed).
 *
 * 3. LINK seam (`documentHref` on the view): WHERE a hit's public page lives. The URL
 *    space belongs to the HOST, not to this package — the same corpus is addressed
 *    `/papers/:slug/:route` on one site and something else on the next, and a package
 *    that assumed either one would be silently wrong on the other. The renderers receive
 *    the finished `href` as a string, so the assumption cannot re-enter through a
 *    renderer either.
 */

// ── Scope / source seam ──────────────────────────────────────────────────────

/** The endpoint paths (joined onto {@link SearchSource.baseUrl}) for one scope. */
export interface SearchSourceEndpoints {
  /** Paginated results endpoint, e.g. `/public/papers`. */
  results: string
  /** Distinct tag-facet endpoint (`{ items: string[] }`), e.g. `/public/papers/tags`. */
  tags?: string
  /** Distinct category-facet endpoint (`{ items: string[] }`), e.g. `/public/papers/categories`. */
  categories?: string
  /**
   * Full-content endpoint for the preview body fetch — a path TEMPLATE with `:slug`
   * and `:route` placeholders, filled from the selected hit (substitutions are
   * URL-encoded by the preview). Defaults to {@link DEFAULT_CONTENT_ENDPOINT}
   * (`'/public/users/:slug/papers/:route'`, the public scope), so today's behavior
   * needs no config; a non-public scope (e.g. bucket-scoped) overrides just this
   * template — no core edit.
   */
  content?: string
}

/** The default preview full-content endpoint template (the public-papers scope). */
export const DEFAULT_CONTENT_ENDPOINT = '/public/users/:slug/papers/:route'

/**
 * Query-param NAME mapping for the results request. Defaults match the backend
 * (`q`/`tag`/`category`/`page`/`pageSize`); a differently-named source overrides only
 * the keys it differs on. The core never hard-codes these names.
 */
export interface SearchQueryParamMap {
  q: string
  tag: string
  category: string
  page: string
  pageSize: string
}

/** The default backend query-param names. */
export const DEFAULT_QUERY_PARAMS: SearchQueryParamMap = {
  q: 'q',
  tag: 'tag',
  category: 'category',
  page: 'page',
  pageSize: 'pageSize',
}

/**
 * An injected search SCOPE. Combines a base URL, the endpoint paths, and (optionally)
 * the query-param names + page size + fetch options. Supplied by the call site —
 * e.g. the public-papers scope is `{ baseUrl: '/api', endpoints: { results:
 * '/public/papers', tags: '/public/papers/tags', categories: '/public/papers/categories' } }`.
 */
export interface SearchSource {
  /** Prefix the endpoint paths are joined onto (e.g. the same-origin `/api` BFF proxy). */
  baseUrl: string
  endpoints: SearchSourceEndpoints
  /** Optional query-param name overrides (merged over {@link DEFAULT_QUERY_PARAMS}). */
  params?: Partial<SearchQueryParamMap>
  /** Result page size (default 50). */
  pageSize?: number
  /** Optional fetch init merged into every request (e.g. `{ cache: 'no-store' }`). */
  fetchInit?: RequestInit
}

// ── Document-type seam ───────────────────────────────────────────────────────

/** The searchable document type. Markdown today; pluggable (string union grows). */
export type DocumentType = 'markdown'

/** The controlled filter axes shared by every document type. */
export interface SearchFilters {
  q: string
  category: string
  tag: string
}

/** Props the core passes to a type's RESULT-ROW renderer for one hit. */
export interface DocumentResultProps<Hit> {
  hit: Hit
  /**
   * This hit's public page on the HOST — already built, by the host's own
   * `documentHref` (seam 3 above). A string rather than the pieces to build one:
   * handing a renderer `hit.author.slug` and letting it join them is exactly how the
   * host's URL space ends up hard-coded in this package.
   */
  href: string
  /** The active free-text query (so a renderer can later highlight matches). */
  query: string
  /** Whether this row is the selected (previewed) one. */
  selected: boolean
  /** Select this hit (drives the master/detail preview). */
  onSelect: (hit: Hit) => void
  /**
   * Roving-tabindex: whether this row is the keyboard-focus target of the results
   * composite (ArrowUp/ArrowDown move it). The renderer puts `tabIndex={0}` on its
   * primary control when `true` and `tabIndex={-1}` when `false`, so the list is a
   * single Tab stop. `undefined` (a standalone render outside the core list) leaves
   * the control's natural tab order untouched.
   */
  active?: boolean
  /**
   * Ref the core attaches to the row's primary focusable control, so ArrowUp/Down can
   * move DOM focus to it. Attach it to the same control that carries the roving
   * `tabIndex` (above).
   */
  controlRef?: Ref<HTMLElement>
}

/** Props the core passes to a type's PREVIEW renderer for the selected hit. */
export interface DocumentPreviewProps<Hit> {
  hit: Hit
  /** The active scope — a preview that fetches full content reads endpoints from here. */
  source: SearchSource
  /** Per-request timeout (ms) for a preview that fetches full content (default 15000). */
  timeoutMs?: number
}

/**
 * Props the core passes to a type's PREVIEW-HEADER renderer (c14).
 *
 * The header (title + kind badge + author + date + summary/evaluation + public-page
 * link) is the SINGLE metadata surface for the selected hit. The preview dock renders
 * it in ONE place (grown from the minimal collapsed bar), so the {@link
 * DocumentTypeConfig.Preview} body must NOT render its own title/metadata header —
 * that would duplicate this one (the c14 bug this slot fixes).
 */
export interface DocumentPreviewHeaderProps<Hit> {
  hit: Hit
  /** This hit's public page on the HOST — see {@link DocumentResultProps.href}. */
  href: string
}

/**
 * One document type's render + identity behavior. The core view is parameterised over
 * this config: it never references markdown specifics, so a new type is just another
 * {@link DocumentTypeConfig}.
 */
export interface DocumentTypeConfig<Hit = unknown> {
  /** The type key (matches a {@link DocumentSearchRegistry} key). */
  type: DocumentType
  /** Stable identity for React keys + selection. NOT a URL — a hit's public page comes
   *  from the host's `documentHref` (seam 3), because only the host knows its own
   *  address space. */
  getId: (hit: Hit) => string
  /**
   * Short human label for a hit — shown in the preview dock's always-present minimal
   * header bar (c14) so the COLLAPSED dock still names what is selected. When the dock
   * is disclosed the SAME header area grows in place to the rich metadata rendered by
   * {@link DocumentTypeConfig.PreviewHeader}; the {@link DocumentTypeConfig.Preview}
   * body then appears below — it must NOT render its own metadata header.
   */
  getTitle: (hit: Hit) => string
  /** The result-row renderer for this type. */
  ResultRow: ComponentType<DocumentResultProps<Hit>>
  /**
   * The disclosed-state metadata HEADER for the selected hit (c14): title, kind badge,
   * author, date, summary/evaluation, public-page link. Rendered by the preview dock as
   * the SINGLE header area (the collapsed minimal bar grows into it), so the metadata
   * lives in exactly one place. The {@link DocumentTypeConfig.Preview} body renders the
   * document content ONLY — never a second title/metadata header.
   */
  PreviewHeader: ComponentType<DocumentPreviewHeaderProps<Hit>>
  /** The preview BODY renderer (rendered content only — no metadata header). */
  Preview: ComponentType<DocumentPreviewProps<Hit>>
}

/**
 * The type registry: a config per document type. Looked up by {@link DocumentType}, so
 * adding a type needs no core change (open/closed). Markdown is the single entry today.
 */
export type DocumentSearchRegistry = {
  [K in DocumentType]: DocumentTypeConfig
}
