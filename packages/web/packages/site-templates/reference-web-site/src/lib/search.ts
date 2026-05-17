import Fuse from 'fuse.js'
import type { SiteEntry } from '../types'

let fuseInstance: Fuse<SiteEntry> | null = null

export function initSearch(entries: SiteEntry[]): Fuse<SiteEntry> {
  fuseInstance = new Fuse(entries, {
    keys: [
      { name: 'frontmatter.title', weight: 3 },
      { name: 'frontmatter.summary', weight: 2 },
      { name: 'domain', weight: 1 },
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
  })
  return fuseInstance
}

export function search(query: string, entries: SiteEntry[]): SiteEntry[] {
  if (!query.trim()) return []
  if (!fuseInstance) initSearch(entries)
  return fuseInstance!.search(query).map((r) => r.item)
}
