import type { ComponentProps, ReactNode } from 'react'
import type { Badge } from '@agentic-toolkit/ui/components/badge'
import type { PaperKind, PaperSearchHit } from './markdown'

/**
 * The PER-KIND renderer seam (c16).
 *
 * A search hit carries a `kind` (`'paper'` | `'research'`, read from frontmatter) that
 * must render VISIBLY differently — not merely a text label. Rather than branch inline
 * inside the markdown row/preview (which would need editing for every future kind), the
 * markdown type's `ResultRow`/`Preview` dispatch on `hit.kind` through THIS map. Adding a
 * new kind (e.g. `'dataset'`) is a single {@link registerKindRenderer} call — the core
 * SearchView and the shared row/preview scaffolding never change (open/closed).
 *
 * A {@link KindRenderer} supplies only the kind-SPECIFIC presentation (a badge, an accent,
 * the row's snippet source, an optional extra preview section). The shared markdown row and
 * preview own the common chrome (title, tags, author, date, fetched markdown body) and fill
 * the per-kind slots from the looked-up renderer. Unknown kinds fall back to
 * {@link DEFAULT_KIND_RENDERER} so an unexpected value degrades gracefully, never throws.
 */

/** A shared-ui {@link Badge} variant name (`'neutral'`, `'accent'`, `'blue'`, …). */
export type KindBadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

/** A kind's visual badge — the small pill shown in the row and the preview header. */
export interface KindBadge {
  /** The pill text (already human-cased, e.g. `'Research'`). */
  label: string
  /**
   * The shared-ui {@link Badge} variant carrying the kind's accent — e.g. `'accent'`
   * (gold) for papers, `'blue'` for research, `'neutral'` for the fallback.
   */
  variant: KindBadgeVariant
}

/** The kind-specific slots the shared row/preview scaffolding fills from the map. */
export interface KindRenderer {
  /** The badge shown in the result row + preview header. */
  badge: KindBadge
  /**
   * The row's snippet/subtitle text for a hit — the per-kind seam over WHAT the row
   * summarises. `research` surfaces the frontmatter `summary` (falling back to the
   * match-context `snippet`); `paper` uses the match-context `snippet`. Returns the raw
   * string (the row highlights query terms) or an empty string for "render no subtitle".
   */
  rowSnippet: (hit: PaperSearchHit) => string
  /**
   * An optional EXTRA preview section, rendered in the preview's metadata header BELOW
   * the common summary line — e.g. `research` surfaces an "Evaluation" block when
   * present. A renderer reads whatever hit fields it needs (research derives
   * `nonEmpty(hit.evaluation)` itself — callers never pre-chew one kind's field into
   * this generic seam). Returns `null` to add nothing.
   */
  previewExtra: (hit: PaperSearchHit) => ReactNode
}

/** Trim a possibly-null/undefined string to a non-empty value, else `null`. */
export function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * The RESEARCH renderer: a distinct blue accent badge; the row surfaces the frontmatter
 * `summary` as its subtitle (falling back to the match-context snippet); the preview adds
 * an "Evaluation" section when an evaluation is present.
 */
const researchKindRenderer: KindRenderer = {
  badge: { label: 'Research', variant: 'blue' },
  rowSnippet: (hit) => nonEmpty(hit.summary) ?? nonEmpty(hit.snippet) ?? '',
  previewExtra: (hit) => {
    const evaluation = nonEmpty(hit.evaluation)
    return evaluation ? (
      <p className="text-xs text-apt-text-muted">
        <span className="font-medium text-apt-blue">Evaluation: </span>
        {evaluation}
      </p>
    ) : null
  },
}

/**
 * The PAPER renderer: the existing gold-accented paper badge; the row uses the
 * match-context `snippet`; no extra preview section.
 */
const paperKindRenderer: KindRenderer = {
  badge: { label: 'Paper', variant: 'accent' },
  rowSnippet: (hit) => nonEmpty(hit.snippet) ?? '',
  previewExtra: () => null,
}

/**
 * The fallback used for any kind not in the map — a neutral badge, the plain match-context
 * snippet, and no extra section. Guarantees a well-formed render for an unexpected `kind`.
 */
export const DEFAULT_KIND_RENDERER: KindRenderer = {
  badge: { label: 'Document', variant: 'neutral' },
  rowSnippet: (hit) => nonEmpty(hit.snippet) ?? '',
  previewExtra: () => null,
}

/**
 * The per-kind renderer map. Keyed on {@link PaperKind} (dispatch uses the MAP KEY —
 * a renderer carries no kind field of its own); a consumer registers a new kind with
 * {@link registerKindRenderer}. Not frozen so a host app can extend it before render.
 */
const KIND_RENDERERS: Record<string, KindRenderer> = {
  paper: paperKindRenderer,
  research: researchKindRenderer,
}

/**
 * Register (or replace) the renderer for a kind. A consumer adds a future kind — e.g.
 * `'dataset'` — with one call, no edit to the core SearchView or the markdown scaffolding:
 *
 * ```ts
 * registerKindRenderer('dataset', {
 *   badge: { label: 'Dataset', variant: 'success' },
 *   rowSnippet: (hit) => hit.snippet,
 *   previewExtra: () => null,
 * })
 * ```
 */
export function registerKindRenderer(kind: string, renderer: KindRenderer): void {
  KIND_RENDERERS[kind] = renderer
}

/**
 * Resolve the renderer for a hit's kind, falling back to {@link DEFAULT_KIND_RENDERER} for
 * a missing/unknown kind so callers never null-check the lookup. Defensively coded: a
 * `null`/`undefined` kind (a hit predating the field) resolves to the default too.
 */
export function kindRendererFor(kind: PaperKind | null | undefined): KindRenderer {
  if (!kind) return DEFAULT_KIND_RENDERER
  return KIND_RENDERERS[kind] ?? DEFAULT_KIND_RENDERER
}
