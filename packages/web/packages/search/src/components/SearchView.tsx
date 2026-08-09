'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react'
import { SearchFilterBar } from '@agentic-toolkit/ui/components/search-filter-bar'
import { Badge } from '@agentic-toolkit/ui/components/badge'
import { Button } from '@agentic-toolkit/ui/components/button'
import { CollapseToggle } from '@agentic-toolkit/ui/components/collapse-toggle'
import { EmptyState } from '@agentic-toolkit/ui/components/empty-state'
import { SplitDivider } from '@agentic-toolkit/ui/components/split-divider'
import type { DocumentTypeConfig, SearchFilters, SearchSource } from '../types'
import { isActiveSearch, useDocumentSearch, useFacets } from '../data/useDocumentSearch'
import { useUrlFilters } from '../data/useUrlFilters'

export interface SearchViewProps<Hit> {
  /** WHERE to search — the injected scope/source (base URL + endpoints + param map). */
  source: SearchSource
  /** HOW results render — the document-type config (result row + preview + identity). */
  documentType: DocumentTypeConfig<Hit>
  /**
   * WHERE a hit's public page lives on THIS host — the link seam. Required, and
   * deliberately without a default: the corpus is addressed differently on every site
   * that mounts this view, so a default would be a guess that is silently wrong
   * everywhere it was not written for, and it would keep working long enough for the
   * host that inherited it to ship the broken link.
   */
  documentHref: (hit: Hit) => string
  /** Accessible label for the search field. */
  searchLabel?: string
  /** Placeholder for the search field. */
  searchPlaceholder?: string
  /**
   * Accessible name for the `role="search"` landmark wrapping the field + filters.
   * Give distinct labels when more than one search region renders on a page.
   */
  searchLandmarkLabel?: string
  /** Debounce (ms) for search/filter changes (default 250). */
  debounceMs?: number
  /** Per-request timeout (ms) for the search + facet + preview fetches (default 15000). */
  timeoutMs?: number
  /**
   * Mirror `q`/`tag`/`category` to the URL query string so a results view is
   * shareable and the back/forward buttons re-sync it. SSR-safe + framework-agnostic.
   * Default on; set false for an embed that owns its own URL or a second instance.
   */
  urlSync?: boolean
  /** Extra classes on the root. */
  className?: string
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Visible, screen-reader-announced result count. Handles singular/plural + zero. */
function resultCountLabel(total: number): string {
  if (total <= 0) return 'No results'
  return `${total.toLocaleString()} result${total === 1 ? '' : 's'}`
}

/**
 * The reusable, CONFIGURABLE document-search view. Driven by three injected seams — the
 * scope/source ({@link SearchViewProps.source}), the document-type config
 * ({@link SearchViewProps.documentType}) and the host's link builder
 * ({@link SearchViewProps.documentHref}) — so it holds NO public-only endpoint, query
 * string, site URL, or markdown specific. Renders the shared `SearchFilterBar` over q + category
 * + tag, fetches results (debounced + instant-on-Enter, plain `fetch`) from the scope,
 * lists them through the type's result row, and previews the selected hit through the
 * type's preview.
 *
 * Layout (c10/c12): a full-width, left-justified VERTICAL stack — search options on
 * top, the full-width result list, then a collapsible preview dock BELOW (c14) with a
 * draggable/keyboard-operable horizontal divider (c13) above it while — and only
 * while — the dock is disclosed (collapsed, there is nothing to resize). Until there
 * is a query OR an active facet the view fetches nothing and shows a prompt instead
 * of auto-loading the corpus (c11).
 *
 * Surfaces a live result count, active-filter chips (each removable, plus the single
 * "Clear filters" control), and the three non-happy states — loading skeleton,
 * zero-results, and an inline error WITH retry. Filters round-trip through the URL so
 * a results view is shareable.
 *
 * Accessibility: the field + filters sit in a labelled `role="search"` landmark; the
 * results are a labelled `<ul>` that is a keyboard composite — ArrowUp/ArrowDown (and
 * Home/End) move a roving tabindex across rows, Enter/Space opens the focused row into
 * the preview (on top of the input's Enter-to-commit), and Escape collapses the
 * preview. Opening a result discloses the preview dock and moves focus into its labelled
 * content region; Escape there restores focus to the row. Focus stays visible (apt-*
 * rings) throughout.
 */
export function SearchView<Hit>({
  source,
  documentType,
  documentHref,
  searchLabel = 'Search documents',
  searchPlaceholder = 'Search…',
  searchLandmarkLabel = 'Document search',
  debounceMs = 250,
  timeoutMs,
  urlSync = true,
  className,
}: SearchViewProps<Hit>): ReactElement {
  const [filters, setFilters] = useUrlFilters(urlSync)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Roving-tabindex cursor: the row that is the list's single Tab stop / arrow-focus
  // target. Distinct from `selectedId` (the previewed row) — arrows move the cursor,
  // Enter on the cursor opens it into the preview.
  const [activeIndex, setActiveIndex] = useState(0)

  const { tags, categories } = useFacets(source, timeoutMs)
  const search = useDocumentSearch<Hit>(source, filters, { debounceMs, timeoutMs })

  const { ResultRow, Preview, PreviewHeader, getId, getTitle } = documentType
  const selectedHit = search.items.find((hit) => getId(hit) === selectedId) ?? null
  // c11 — a search is "active" once there is a query OR a facet filter. Until then the
  // data layer skips the fetch and we render the search prompt instead of any list.
  // Shared with the data hook (isActiveSearch) so view and hook agree on the condition.
  const isActive = isActiveSearch(filters)
  // Facet-specific (tag/category) activity — drives the zero-state's "remove filters" hint.
  const hasFacets = Boolean(filters.tag || filters.category)
  const hardError = search.phase === 'error' && search.items.length === 0
  const staleError = search.phase === 'error' && search.items.length > 0

  // c13 — the split ratio: fraction of the split height given to the LIST (above the
  // divider); the preview dock takes the rest. Bounded in the divider.
  const [listRatio, setListRatio] = useState(0.62)
  // c14 — whether the preview dock is disclosed (expanded). Always-present header shows
  // regardless; disclosing reveals the full metadata header + rendered markdown.
  const [previewDisclosed, setPreviewDisclosed] = useState(false)
  const splitRef = useRef<HTMLDivElement | null>(null)

  // DOM refs for focus management: each row's primary control, and the preview region.
  const rowRefs = useRef<Array<HTMLElement | null>>([])
  const previewRef = useRef<HTMLDivElement | null>(null)
  // Set when a selection is made by the user, so the focus-move effect only runs then
  // (never on an unrelated re-render of an already-open preview).
  const focusPreviewRef = useRef(false)

  const itemCount = search.items.length

  // Keep the roving cursor in range as the result set changes (a re-query can shrink it).
  useEffect(() => {
    setActiveIndex((i) => (itemCount === 0 ? 0 : Math.min(i, itemCount - 1)))
  }, [itemCount])

  const registerRow = useCallback((index: number, el: HTMLElement | null): void => {
    rowRefs.current[index] = el
  }, [])

  const focusRow = useCallback((index: number): void => {
    setActiveIndex(index)
    rowRefs.current[index]?.focus()
  }, [])

  const selectHit = useCallback(
    (hit: Hit): void => {
      const id = getId(hit)
      if (id === selectedId && previewDisclosed) {
        // Re-selecting the already-open row changes NO state, so the focus effect
        // below never re-runs — move focus into the preview directly instead.
        previewRef.current?.focus()
        return
      }
      focusPreviewRef.current = true
      setPreviewDisclosed(true) // c14 — selecting a result opens it disclosed.
      setSelectedId(id)
    },
    [getId, selectedId, previewDisclosed],
  )

  const clearSelection = useCallback((): void => {
    setSelectedId(null)
    setPreviewDisclosed(false) // c14 — Escape collapses the dock back to its header bar.
  }, [])

  // After a user selection, move focus into the preview region so the keyboard user
  // lands on what they just opened (the region is labelled + programmatically
  // focusable). Depends on BOTH the selection and the disclosure so a re-select of the
  // same row after a collapse (selectedId unchanged, disclosed flips) still focuses;
  // gated by focusPreviewRef so an unrelated re-render or a header-toggle disclose
  // never steals focus.
  useEffect(() => {
    if (selectedId && previewDisclosed && focusPreviewRef.current) {
      focusPreviewRef.current = false
      previewRef.current?.focus()
    }
  }, [selectedId, previewDisclosed])

  // The chips' "Clear filters" clears the active FACETS but keeps the query — clicking it
  // to drop a tag shouldn't erase your search (which, empty-by-default, would blank the
  // view). Labelled "Clear filters" (not "Clear all") so the label matches what it clears.
  const clearFacets = (): void => setFilters((f) => ({ ...f, tag: '', category: '' }))
  const removeFilter = (key: 'tag' | 'category'): void =>
    setFilters((f) => ({ ...f, [key]: '' }))

  // Enter commits the search NOW (flushes the debounce) on top of live typing.
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      search.refresh()
    }
  }

  // Arrow/Home/End roving across rows; Escape collapses the preview. Enter/Space are
  // left to the focused row control's native activation (which calls selectHit).
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (itemCount === 0) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusRow(Math.min(activeIndex + 1, itemCount - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        focusRow(Math.max(activeIndex - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        focusRow(0)
        break
      case 'End':
        event.preventDefault()
        focusRow(itemCount - 1)
        break
      case 'Escape':
        if (selectedId) {
          event.preventDefault()
          clearSelection()
        }
        break
    }
  }

  // Escape anywhere inside the preview DOCK (header controls + body — the handler sits
  // on the outer section) collapses it and returns focus to the row that opened it.
  const onPreviewKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && selectedId) {
      event.preventDefault()
      clearSelection()
      rowRefs.current[activeIndex]?.focus()
    }
  }

  return (
    // c10 — full-width, left-justified: the view spans its container; no centered
    // max-width column here (the consumer removes its centering wrapper too).
    <div className={cx('flex w-full flex-col gap-4', className)}>
      {/* Search options on top (c12). */}
      <SearchFilterBar
        aria-label={searchLandmarkLabel}
        search={{
          value: filters.q,
          onChange: (q) => setFilters((f) => ({ ...f, q })),
          label: searchLabel,
          placeholder: searchPlaceholder,
          onKeyDown: onSearchKeyDown,
        }}
        filters={[
          {
            name: 'category',
            label: 'Filter by category',
            value: filters.category,
            options: categories,
            allLabel: 'All categories',
            onChange: (category) => setFilters((f) => ({ ...f, category })),
          },
          {
            name: 'tag',
            label: 'Filter by tag',
            value: filters.tag,
            options: tags,
            allLabel: 'All tags',
            onChange: (tag) => setFilters((f) => ({ ...f, tag })),
          },
        ]}
      />

      <ActiveFilterChips filters={filters} onRemove={removeFilter} onClearAll={clearFacets} />

      {!isActive ? (
        // c11 — nothing until you search: no fetch, no list, just a prompt.
        <EmptyState
          title="Search research documents to get started."
          description="Type a query above, or pick a category or tag, to search across every researcher."
          className="w-full"
        />
      ) : (
        // c12 — vertical stack: result list on top, a horizontal divider, then the
        // preview dock BELOW. The split has a bounded height so the divider resize
        // (c13) is meaningful; both panes scroll internally.
        // c18 — responsive height: on a SHORT mobile viewport (≤375-ish) 70vh + a
        // 420px floor crowds the list off-screen, so the floor is a smaller 320px there
        // and the split is 65vh; from `sm:` up it grows to 70vh with the 420px floor
        // through 1440. The stack stays single-column at every width; both panes scroll
        // internally. apt-*/Tailwind breakpoints only — no !important.
        <div
          ref={splitRef}
          className="flex h-[65vh] min-h-[320px] w-full flex-col sm:h-[70vh] sm:min-h-[420px]"
        >
          {/* Result list (above the divider). */}
          <div
            aria-busy={search.phase === 'loading' || undefined}
            className="flex min-h-0 flex-col gap-3 overflow-auto pr-1"
            style={{ flex: `${Math.round(listRatio * 1000)} 1 0%` }}
          >
            {search.settled && !hardError && (
              <p className="text-xs text-apt-text-dim" role="status" aria-live="polite">
                {resultCountLabel(search.total)}
              </p>
            )}

            {staleError && (
              <ErrorState message={search.error} onRetry={search.refresh} compact />
            )}

            {renderList<Hit>({
              search,
              hasFacets,
              ResultRow,
              getId,
              documentHref,
              query: filters.q,
              selectedId,
              activeIndex,
              onSelect: selectHit,
              onListKeyDown,
              registerRow,
              onRetry: search.refresh,
            })}
          </div>

          {/* c13 — the draggable + keyboard-operable horizontal divider. Rendered ONLY
              while the preview dock is disclosed: collapsed, there is nothing to resize
              (the dock is its natural header-bar height), so no dead separator/steppers
              and no aria promising a resize that does nothing. */}
          {previewDisclosed && (
            <SplitDivider
              ratio={listRatio}
              onRatioChange={setListRatio}
              containerRef={splitRef}
              label="Resize preview"
              growBottomLabel="Enlarge preview"
              growTopLabel="Enlarge results"
            />
          )}

          {/* c14 — the preview dock: ONE header area (minimal when collapsed, the full
              metadata header when disclosed) + a disclose toggle, with the rendered
              markdown body below only when disclosed. */}
          <PreviewDock
            title={selectedHit ? getTitle(selectedHit) : null}
            disclosed={previewDisclosed}
            onToggleDisclosed={() => setPreviewDisclosed((d) => !d)}
            previewRef={previewRef}
            onKeyDown={onPreviewKeyDown}
            ratio={1 - listRatio}
            header={
              selectedHit ? (
                <PreviewHeader hit={selectedHit} href={documentHref(selectedHit)} />
              ) : null
            }
          >
            {selectedHit ? (
              <Preview hit={selectedHit} source={source} timeoutMs={timeoutMs} />
            ) : (
              <EmptyState
                title="Select a result to preview it."
                className="h-full border-0"
              />
            )}
          </PreviewDock>
        </div>
      )}
    </div>
  )
}

/**
 * c14 — the collapsible preview dock with a SINGLE header area. There is exactly ONE
 * header for the selected doc, never two stacked title rows:
 *
 * - Collapsed (undisclosed): a minimal-height header bar naming the selected doc (its
 *   `title`) + a subtitle hint. No body.
 * - Disclosed: the SAME header area grows in place to the full metadata `header` slot
 *   (title, kind badge, author, date, summary/evaluation, public-page link — supplied by
 *   the type's `PreviewHeader`); the rendered markdown body appears BELOW. The metadata
 *   header owns the single title (`<h3>`), so the collapsed bar's title text is NOT
 *   shown when disclosed — no duplicate row. When nothing is selected while disclosed,
 *   the body's empty state is the ONLY "Select a result…" text (the header renders
 *   nothing) — one owner, no double render.
 *
 * The disclosure control is ONE always-mounted {@link CollapseToggle} in the header row
 * (accessible name "Collapse preview" / "Expand preview", aria-expanded + aria-controls
 * onto the body region). Because it never unmounts across the flip, the browser retains
 * keyboard focus on it — no refocus machinery. The collapsed title area stays a large
 * SECONDARY pointer click surface routed to the same handler, without a second
 * accessible control.
 *
 * The body region is a labelled, programmatically-focusable `<div tabIndex={-1}>` (not
 * a second landmark — the outer section is the single "Document preview" landmark) so
 * opening a result moves focus into it. Escape is handled on the OUTER section, so it
 * collapses the dock from the header controls (toggle, View-full-paper link) too and
 * returns focus to the row (caller-owned). apt-* tokens only.
 */
function PreviewDock({
  title,
  disclosed,
  onToggleDisclosed,
  previewRef,
  onKeyDown,
  ratio,
  header,
  children,
}: {
  title: string | null
  disclosed: boolean
  onToggleDisclosed: () => void
  previewRef: RefObject<HTMLDivElement | null>
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  ratio: number
  /** The full metadata header (the type's PreviewHeader) — shown only when disclosed. */
  header: ReactElement | null
  children: ReactElement
}): ReactElement {
  const contentId = useId()

  return (
    <section
      aria-label="Document preview"
      onKeyDown={onKeyDown}
      className={cx(
        'flex w-full flex-col overflow-hidden rounded-xl border border-apt-border bg-apt-surface',
        // When disclosed the dock grows to fill its share of the split; collapsed it is
        // just the minimal header bar (its natural height).
        disclosed ? 'min-h-0' : 'shrink-0',
      )}
      style={disclosed ? { flex: `${Math.max(1, Math.round(ratio * 1000))} 1 0%` } : undefined}
    >
      {/* The SINGLE header area — grows in place from the minimal bar to the full
          metadata when disclosed. Exactly one title renders in each state. The
          CollapseToggle is THE disclosure control and is mounted in BOTH states. */}
      <div className="flex shrink-0 items-start gap-2 px-3 py-2">
        <CollapseToggle
          collapsed={!disclosed}
          onToggle={onToggleDisclosed}
          label="preview"
          controls={disclosed ? contentId : undefined}
        />
        {disclosed ? (
          // Full metadata header (the type's PreviewHeader) owns the single title.
          // With no selection it renders NOTHING — the body EmptyState below is the
          // single owner of the "Select a result to preview it." text.
          <div className="min-w-0 flex-1">{header}</div>
        ) : (
          // Collapsed — the title area is a SECONDARY pointer click surface for the
          // same toggle action (large target), deliberately not a focusable control:
          // the CollapseToggle beside it is the one accessible disclosure control.
          <div
            onClick={onToggleDisclosed}
            className="flex min-w-0 flex-1 cursor-pointer flex-col"
          >
            <span className="truncate text-sm font-medium text-apt-text">
              {title ?? 'Preview'}
            </span>
            <span className="truncate text-xs text-apt-text-muted">
              {title ? 'Collapsed — expand to preview' : 'Select a result to preview it.'}
            </span>
          </div>
        )}
      </div>

      {disclosed && (
        <div
          id={contentId}
          ref={previewRef}
          tabIndex={-1}
          aria-label="Document preview content"
          className="min-h-0 flex-1 overflow-auto border-t border-apt-border outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-apt-gold/40"
        >
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * The active-filter chip strip (c11): one removable chip per active facet axis plus a
 * Clear all control. Reuses the shared {@link Badge} for the chip and {@link Button}
 * for Clear all. Renders nothing when no facet filter is active.
 */
function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
}: {
  filters: SearchFilters
  onRemove: (key: 'tag' | 'category') => void
  onClearAll: () => void
}): ReactElement | null {
  const active: Array<{ key: 'tag' | 'category'; label: string; value: string }> = []
  if (filters.category) active.push({ key: 'category', label: 'Category', value: filters.category })
  if (filters.tag) active.push({ key: 'tag', label: 'Tag', value: filters.tag })
  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {active.map((chip) => (
        <Badge key={chip.key} variant="neutral" className="gap-1 pr-1">
          <span>
            {chip.label}: {chip.value}
          </span>
          {/* The visible glyph stays a tasteful 16px, but an invisible centred
              `::after` overlay enlarges the clickable target to 24×24 CSS px so the
              control meets WCAG 2.2 SC 2.5.8 (Target Size, Minimum). */}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            aria-label={`Remove ${chip.label.toLowerCase()} filter ${chip.value}`}
            className="relative inline-flex size-4 items-center justify-center rounded-full leading-none text-apt-text-dim transition-colors hover:bg-apt-surface-2 hover:text-apt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40 after:absolute after:left-1/2 after:top-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          >
            <span aria-hidden>×</span>
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="xs" onClick={onClearAll}>
        Clear filters
      </Button>
    </div>
  )
}

/** Inline error + retry (c15). `compact` = a thin strip above stale results. */
function ErrorState({
  message,
  onRetry,
  compact,
}: {
  message: string | null
  onRetry: () => void
  compact?: boolean
}): ReactElement {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col gap-3 rounded-lg border border-apt-red/40 bg-apt-red/5 px-4 py-3 text-sm text-apt-red',
        !compact && 'min-h-[160px] items-center justify-center text-center',
      )}
    >
      <p>{message ?? 'Something went wrong loading results.'}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className={compact ? 'self-start' : 'self-center'}
      >
        Retry
      </Button>
    </div>
  )
}

function renderList<Hit>({
  search,
  hasFacets,
  ResultRow,
  getId,
  documentHref,
  query,
  selectedId,
  activeIndex,
  onSelect,
  onListKeyDown,
  registerRow,
  onRetry,
}: {
  search: ReturnType<typeof useDocumentSearch<Hit>>
  hasFacets: boolean
  ResultRow: DocumentTypeConfig<Hit>['ResultRow']
  getId: DocumentTypeConfig<Hit>['getId']
  documentHref: (hit: Hit) => string
  query: string
  selectedId: string | null
  activeIndex: number
  onSelect: (hit: Hit) => void
  onListKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  registerRow: (index: number, el: HTMLElement | null) => void
  onRetry: () => void
}): ReactElement {
  // (a) Initial skeleton only before any data has resolved (re-queries keep results
  // shown). Covers the brief `idle` tick right after a search becomes active, before
  // the fetch effect flips the phase to `loading`.
  if (!search.settled && (search.phase === 'loading' || search.phase === 'idle')) {
    return (
      <ul aria-busy="true" aria-label="Loading results" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-lg border border-apt-border bg-apt-surface-2"
          />
        ))}
      </ul>
    )
  }

  // (c) Error with no results to fall back on → full error block WITH retry.
  if (search.phase === 'error' && search.items.length === 0) {
    return <ErrorState message={search.error} onRetry={onRetry} />
  }

  // (b) Zero results → a clear message. No "Clear filters" button here: whenever a
  // facet is active the chips strip above already shows per-chip × plus the ONE
  // "Clear filters" control — one label, one control (a second identically-labelled
  // button here wiped the query too, blanking the whole view).
  if (search.items.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-apt-border p-8 text-center">
        <p className="text-sm font-medium text-apt-text-muted">No matching documents</p>
        <p className="max-w-prose text-xs text-apt-text-dim">
          {hasFacets
            ? 'Try a different search or remove filters.'
            : 'Try a different search.'}
        </p>
      </div>
    )
  }

  return (
    <ul
      aria-label="Search results"
      onKeyDown={onListKeyDown}
      className="flex flex-col gap-3"
    >
      {search.items.map((hit, index) => {
        const id = getId(hit)
        return (
          <li key={id}>
            <ResultRow
              hit={hit}
              href={documentHref(hit)}
              query={query}
              selected={id === selectedId}
              active={index === activeIndex}
              controlRef={(el) => registerRow(index, el)}
              onSelect={onSelect}
            />
          </li>
        )
      })}
    </ul>
  )
}
