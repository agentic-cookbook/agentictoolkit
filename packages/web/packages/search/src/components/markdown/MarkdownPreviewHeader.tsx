'use client'

import type { ReactElement } from 'react'
import { Badge } from '@agentic-toolkit/ui/components/badge'
import type { DocumentPreviewHeaderProps } from '../../types'
import type { PaperSearchHit } from '../../registry/markdown'
import { kindRendererFor, nonEmpty } from '../../registry/kinds'
import { formatDate } from '../../lib/format'

/**
 * The markdown preview METADATA header (c14) — the SINGLE metadata surface for the
 * selected hit: title, a per-kind badge, author attribution, date, the frontmatter
 * summary + a per-kind extra section (e.g. research's Evaluation), and the public-page
 * link. Rendered by the preview dock in ONE place (the collapsed minimal bar grows into
 * it on disclose); {@link MarkdownPreview} renders the body ONLY, never a second header.
 *
 * PER-KIND (c16): the badge accent + the optional extra section come from the
 * {@link kindRendererFor} map, so a future kind changes only its map entry, never this
 * component. Styled with the shared `apt-*` tokens only.
 */

export function MarkdownPreviewHeader({
  hit,
  href,
}: DocumentPreviewHeaderProps<PaperSearchHit>): ReactElement {
  const author = hit.author.displayName?.trim() || `@${hit.author.slug}`
  const date = hit.updatedAt ? formatDate(hit.updatedAt) : ''
  // Null-guard the summary: trim to a non-empty value, else null → renders nothing.
  const summary = nonEmpty(hit.summary)
  // c16 — the per-kind renderer supplies the header badge (a distinct accent) and an
  // optional extra section (e.g. research's Evaluation block, which reads hit.evaluation
  // itself). Unknown kinds fall back to the neutral default.
  const renderer = kindRendererFor(hit.kind)
  const previewExtra = renderer.previewExtra(hit)
  // A hit with no public route has no public page, so there is nothing to link to —
  // `href` is still a well-formed string in that case, which is why the guard reads the
  // route rather than the URL built from it.
  const route = hit.publicRoute

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-semibold text-apt-text" title={hit.title}>
          {hit.title || 'Untitled'}
        </h3>
        {route && (
          <a
            href={href}
            className="inline-flex min-h-6 shrink-0 items-center rounded-sm text-xs font-medium text-apt-gold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-apt-gold/40"
          >
            View full paper
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-apt-text-dim">
        {/* c16 — the per-kind badge (shared Badge), matching the result row's accent. */}
        <Badge variant={renderer.badge.variant}>{renderer.badge.label}</Badge>
        <span>
          by <span className="text-apt-text-muted">{author}</span>
        </span>
        {date && <span>· Updated {date}</span>}
      </div>

      {summary && (
        <p className="text-xs text-apt-text-muted">
          <span className="font-medium text-apt-text-dim">Summary: </span>
          {summary}
        </p>
      )}
      {/* c16 — the per-kind extra section (e.g. research's Evaluation). Already
          null-guarded by the renderer; renders nothing for kinds without one. */}
      {previewExtra}
    </div>
  )
}
