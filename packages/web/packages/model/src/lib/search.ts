import Fuse from 'fuse.js'
import type { SiteEntry } from '../types'

export type SearchResult = {
  entry: SiteEntry
  score: number
}

export type SearchIndex = {
  query: (q: string) => SearchResult[]
}

export function createSearchIndex(entries: SiteEntry[]): SearchIndex {
  const fuse = new Fuse(entries, {
    keys: [
      { name: 'frontmatter.title', weight: 3 },
      { name: 'frontmatter.summary', weight: 2 },
      { name: 'domain', weight: 1 },
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
  })
  return {
    query(q: string): SearchResult[] {
      if (!q.trim()) return []
      return fuse.search(q).map((r) => ({ entry: r.item, score: r.score ?? 0 }))
    },
  }
}
