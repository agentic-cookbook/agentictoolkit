import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KIND_RENDERER,
  kindRendererFor,
  registerKindRenderer,
  type KindRenderer,
} from '../registry/kinds'
import type { PaperSearchHit } from '../registry/markdown'

/** A minimal hit builder — only the fields the kind renderers read. */
function hit(over: Partial<PaperSearchHit> = {}): PaperSearchHit {
  return {
    id: 'p1',
    title: 'T',
    publicRoute: 'r',
    author: { slug: 's', displayName: null },
    category: null,
    tags: [],
    snippet: 'match-context snippet',
    createdAt: '',
    updatedAt: '',
    kind: 'paper',
    ...over,
  }
}

describe('kindRendererFor — per-kind dispatch (c16)', () => {
  it('dispatches paper vs research to distinct badges', () => {
    expect(kindRendererFor('paper').badge.label).toBe('Paper')
    expect(kindRendererFor('research').badge.label).toBe('Research')
    // Visibly distinct accents (not merely a text label).
    expect(kindRendererFor('paper').badge.variant).not.toBe(
      kindRendererFor('research').badge.variant,
    )
  })

  it('research surfaces the frontmatter summary as the row subtitle', () => {
    const h = hit({ kind: 'research', summary: 'the summary line', snippet: 'ctx' })
    expect(kindRendererFor('research').rowSnippet(h)).toBe('the summary line')
  })

  it('research falls back to the match-context snippet when summary is empty', () => {
    const h = hit({ kind: 'research', summary: '   ', snippet: 'ctx' })
    expect(kindRendererFor('research').rowSnippet(h)).toBe('ctx')
  })

  it('paper uses the match-context snippet for the row subtitle', () => {
    const h = hit({ kind: 'paper', summary: 'ignored for paper', snippet: 'ctx' })
    expect(kindRendererFor('paper').rowSnippet(h)).toBe('ctx')
  })

  it('research renders an Evaluation extra section only when evaluation is present', () => {
    const r = kindRendererFor('research')
    expect(r.previewExtra(hit({ kind: 'research', evaluation: 'an evaluation' }))).not.toBeNull()
    expect(r.previewExtra(hit({ kind: 'research', evaluation: null }))).toBeNull()
  })

  it('paper renders no extra preview section', () => {
    expect(kindRendererFor('paper').previewExtra(hit())).toBeNull()
  })

  it('falls back to the default renderer for an unknown or missing kind', () => {
    // c16 — `kind` is the OPEN `PaperKind` (`'paper' | 'research' | (string & {})`), so
    // an unregistered kind is a plain string with NO cast; it still falls back.
    expect(kindRendererFor('unregistered-kind')).toBe(DEFAULT_KIND_RENDERER)
    expect(kindRendererFor(null)).toBe(DEFAULT_KIND_RENDERER)
    expect(kindRendererFor(undefined)).toBe(DEFAULT_KIND_RENDERER)
  })

  it('lets a consumer register + use a NEW kind with no core edit and no cast', () => {
    // c16 PROOF: registering/using a brand-new `'dataset'` kind needs NO cast and NO
    // edit to registry/markdown.ts — the open `PaperKind` accepts any string directly.
    const dataset: KindRenderer = {
      badge: { label: 'Dataset', variant: 'success' },
      rowSnippet: (h) => h.snippet,
      previewExtra: () => null,
    }
    registerKindRenderer('dataset', dataset)
    // A hit carrying the new kind also type-checks with a bare string.
    const h: PaperSearchHit = hit({ kind: 'dataset', snippet: 'dataset ctx' })
    expect(kindRendererFor(h.kind)).toBe(dataset)
    expect(kindRendererFor('dataset').rowSnippet(h)).toBe('dataset ctx')
  })
})
