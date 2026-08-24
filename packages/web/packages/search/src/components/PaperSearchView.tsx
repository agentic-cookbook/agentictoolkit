'use client'

import type { ReactElement } from 'react'

import { SearchView } from './SearchView'
import { markdownDocumentType, type PaperSearchHit } from '../registry/markdown'
import type { SearchSource } from '../types'

/**
 * The public paper corpus as a {@link SearchSource}. It lives here rather than at each call
 * site because the endpoints ARE the corpus — a site restating them is a site that can start
 * searching a different one — and because the author scope has to reach the facet requests
 * too, which only a source can do.
 *
 * `documentHref` is deliberately NOT here: the URL space belongs to the host (see the seam
 * doctrine at the top of `types.ts`), and the same corpus is addressed differently on the
 * next site.
 */
export function paperSearchSource(opts?: { baseUrl?: string; authorSlug?: string }): SearchSource {
  const slug = opts?.authorSlug?.trim().toLowerCase()
  return {
    baseUrl: opts?.baseUrl ?? '/api',
    endpoints: {
      results: '/public/papers',
      tags: '/public/papers/tags',
      categories: '/public/papers/categories',
    },
    // The corpus is edited continuously and the search page is the only way to see that a
    // paper exists, so a cached answer is a paper the reader is told is not there.
    fetchInit: { cache: 'no-store' },
    ...(slug ? { fixedParams: { author: slug } } : {}),
  }
}

export interface PaperSearchViewProps {
  /** Where a hit's public page lives, on THIS host. */
  documentHref: (hit: PaperSearchHit) => string
  /** Narrow the corpus to one author (their public index page). Omit for the whole corpus. */
  authorSlug?: string
  /** Override the API prefix (defaults to the same-origin `/api` BFF proxy). */
  baseUrl?: string
  searchLabel?: string
  searchPlaceholder?: string
  searchLandmarkLabel?: string
}

/**
 * The public paper search control — ONE control, mounted both on the corpus-wide search page
 * and on an author's index page, which differ only by `authorSlug`. Before this existed each
 * mount configured its own `SearchView`, and "the author page searches something slightly
 * different from /search" was a one-line drift away.
 *
 * The accessible names are props with defaults rather than literals: the package owns the UI,
 * the host owns the words.
 */
export function PaperSearchView({
  documentHref,
  authorSlug,
  baseUrl,
  searchLabel = 'Search research papers',
  searchPlaceholder = 'Search papers…',
  searchLandmarkLabel = 'Research paper search',
}: PaperSearchViewProps): ReactElement {
  return (
    <SearchView
      source={paperSearchSource({ baseUrl, authorSlug })}
      documentType={markdownDocumentType}
      documentHref={documentHref}
      searchLabel={searchLabel}
      searchPlaceholder={searchPlaceholder}
      searchLandmarkLabel={searchLandmarkLabel}
    />
  )
}
