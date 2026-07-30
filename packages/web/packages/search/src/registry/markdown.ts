import type { DocumentSearchRegistry, DocumentTypeConfig } from '../types'
import { MarkdownResultRow } from '../components/markdown/MarkdownResultRow'
import { MarkdownPreview } from '../components/markdown/MarkdownPreview'
import { MarkdownPreviewHeader } from '../components/markdown/MarkdownPreviewHeader'

/**
 * A single cross-author search hit from `GET /public/papers`. Mirrors the backend
 * `PublicPaperSearchHit` contract (websites/backend/src/openapi/paths/public.ts) —
 * defined locally rather than imported from @agentic-toolkit/adh-api-types, since this search
 * endpoint post-dates the generated snapshot. Matches the marketing convention
 * (papers-api.ts defines its public shapes locally).
 */
/**
 * The document kind carried by each hit (read from frontmatter by the backend).
 *
 * OPEN union (c16): the two KNOWN kinds keep autocomplete, but `string & {}` lets the
 * type accept ANY string, so registering + using a NEW kind (e.g. `'dataset'`) via
 * {@link registerKindRenderer} type-checks with NO edit to this file (true open/closed
 * extensibility). The `& {}` intersection is the idiom that widens the union to all
 * strings WITHOUT collapsing the literals away (which would kill known-kind completion).
 */
export type PaperKind = 'paper' | 'research' | (string & {})

export interface PaperSearchHit {
  id: string
  title: string
  publicRoute: string
  author: { slug: string; displayName: string | null }
  category: string | null
  tags: string[]
  /** ~200-char match-context excerpt (plain text; no markup). */
  snippet: string
  createdAt: string
  updatedAt: string
  /**
   * Which kind of document this is — `'paper'` | `'research'` | any registered kind —
   * read from the document's frontmatter by the backend. Dispatches the per-kind badge,
   * row subtitle, and extra preview section through {@link kindRendererFor} (c16). The
   * type is open ({@link PaperKind}), so a NEW kind needs no edit here.
   */
  kind: PaperKind
  /** Frontmatter summary line, when present (may be null). */
  summary?: string | null
  /** Frontmatter evaluation line, when present (may be null). */
  evaluation?: string | null
}

/**
 * The MARKDOWN document-type config — the single entry in the type registry today.
 * Binds the markdown result-row + preview renderers and identity. The core SearchView
 * is parameterised over this, so a future document type is added by registering
 * another {@link DocumentTypeConfig}, never by editing the core (open/closed).
 */
export const markdownDocumentType: DocumentTypeConfig<PaperSearchHit> = {
  type: 'markdown',
  getId: (hit) => hit.id,
  getTitle: (hit) => hit.title?.trim() || 'Untitled',
  ResultRow: MarkdownResultRow,
  // c14 — the SINGLE metadata header (title/badge/author/date/summary/evaluation/link),
  // rendered once by the preview dock; the Preview body renders content only.
  PreviewHeader: MarkdownPreviewHeader,
  Preview: MarkdownPreview,
}

/**
 * The document-type registry: looked up by {@link DocumentType}. Markdown is the only
 * entry today. The per-type Hit is erased here (a heterogeneous map cannot preserve it)
 * — the type-safe path is passing a config to `SearchView` directly; this map is for
 * call sites that select by the string type key.
 */
export const DOCUMENT_SEARCH_REGISTRY: DocumentSearchRegistry = {
  markdown: markdownDocumentType as unknown as DocumentTypeConfig,
}
