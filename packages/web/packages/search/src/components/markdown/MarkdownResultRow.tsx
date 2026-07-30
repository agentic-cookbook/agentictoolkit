'use client'

import { Fragment, type ReactElement, type ReactNode, type Ref } from 'react'
import { Badge } from '@agentic-toolkit/ui/components/badge'
import type { DocumentResultProps } from '../../types'
import type { PaperSearchHit } from '../../registry/markdown'
import { kindRendererFor } from '../../registry/kinds'
import { formatDate } from '../../lib/format'
import { splitHighlightSegments } from '../../lib/highlight'

/**
 * Render `text` with the active query terms wrapped in `<mark>` (c13). Matches are
 * located by {@link splitHighlightSegments} and the text is emitted as plain React
 * children (React escapes it) — never `dangerouslySetInnerHTML`. An empty query
 * yields the text verbatim with no marks. `<mark>` is themed via `apt-*` tokens.
 */
function Highlighted({ text, query }: { text: string; query: string }): ReactNode {
  const segments = splitHighlightSegments(text, query)
  return segments.map((seg, i) =>
    seg.match ? (
      <mark key={i} className="rounded-sm bg-apt-gold/25 px-0.5 text-apt-text">
        {seg.text}
      </mark>
    ) : (
      <Fragment key={i}>{seg.text}</Fragment>
    ),
  )
}

/**
 * The markdown result row (c13): a kind BADGE, title, a per-kind snippet/subtitle, tags,
 * category, author attribution (displayName + @slug), and date. The active query terms are
 * wrapped in `<mark>` within the title and snippet (escape-safe React nodes). The card
 * body is a SELECT button (drives the master/detail preview); a sibling anchor opens
 * the public paper page at `/:slug/:publicRoute` — kept siblings so neither nests the
 * other (valid, accessible interactive structure).
 *
 * PER-KIND (c16): the row is shared scaffolding with per-kind SLOTS filled from the
 * {@link kindRendererFor} map — the badge accent (a distinct apt-* color per kind) and the
 * subtitle SOURCE (`research` surfaces the frontmatter `summary`; `paper` the match-context
 * `snippet`). A future kind changes only its map entry, never this component.
 *
 * Styled with the shared `apt-*` design tokens only, so it themes with every variant
 * and renders correctly in the marketing app (whose Tailwind never scans
 * @agentic-toolkit/ui) via this package's own compiled stylesheet.
 */
export function MarkdownResultRow({
  hit,
  query,
  selected,
  onSelect,
  active,
  controlRef,
}: DocumentResultProps<PaperSearchHit>): ReactElement {
  const author = hit.author.displayName?.trim() || `@${hit.author.slug}`
  const href = `/${hit.author.slug}/${hit.publicRoute}`
  // c16 — the per-kind renderer supplies the badge accent + the subtitle source. A
  // missing/unknown kind falls back to the default renderer (never throws).
  const renderer = kindRendererFor(hit.kind)
  const snippet = renderer.rowSnippet(hit).trim()
  // Roving tabindex: when the core marks this row active it is the list's single Tab
  // stop (0); inactive rows are skipped (-1). `undefined` (a standalone render outside
  // the core list) leaves the natural tab order untouched.
  const rovingTab = active === undefined ? undefined : active ? 0 : -1

  return (
    <article
      className={[
        'flex flex-col gap-2 rounded-lg border bg-apt-bg p-4 transition-colors',
        selected ? 'border-apt-gold' : 'border-apt-border hover:border-apt-border-strong',
      ].join(' ')}
    >
      <button
        ref={controlRef as Ref<HTMLButtonElement>}
        type="button"
        tabIndex={rovingTab}
        onClick={() => onSelect(hit)}
        aria-pressed={selected}
        className="flex flex-col gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/25 rounded-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {/* c16 — the per-kind badge: the shared Badge, its accent chosen per kind. */}
            <Badge variant={renderer.badge.variant} className="self-start">
              {renderer.badge.label}
            </Badge>
            <h3 className="text-base font-semibold text-apt-text">
              <Highlighted text={hit.title || 'Untitled'} query={query} />
            </h3>
          </div>
          {hit.category && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-apt-border px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-apt-text-dim">
              {hit.category}
            </span>
          )}
        </div>

        {snippet && (
          <p className="line-clamp-2 text-sm text-apt-text-muted">
            <Highlighted text={snippet} query={query} />
          </p>
        )}

        {hit.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hit.tags.map((t) => (
              <span key={t} className="text-xs text-apt-text-muted">
                #{t}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-apt-text-dim">
        <span>
          by <span className="text-apt-text-muted">{author}</span>
          {hit.updatedAt && <> · Updated {formatDate(hit.updatedAt)}</>}
        </span>
        {/* The label stays a tasteful 12px, but an invisible full-width `::after`
            overlay (centred vertically, 24px tall) enlarges the clickable target to
            ≥24 CSS px in height so the link meets WCAG 2.2 SC 2.5.8 (Target Size,
            Minimum) — the same idiom the active-filter chip × button uses. */}
        <a
          href={href}
          tabIndex={rovingTab}
          className="relative rounded-sm font-medium text-apt-gold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-apt-gold/40 after:absolute after:inset-x-0 after:top-1/2 after:h-6 after:-translate-y-1/2 after:content-['']"
        >
          View paper
        </a>
      </div>
    </article>
  )
}
