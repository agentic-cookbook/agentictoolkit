/// <reference path="../types-virtual.d.ts" />
import entries from 'virtual:reference-site-content'
import type { SiteEntry } from '../types'

export { entries }

const bySlug = new Map<string, SiteEntry>()
const byDomain = new Map<string, SiteEntry>()

for (const entry of entries) {
  bySlug.set(entry.slug, entry)
  if (entry.domain) byDomain.set(entry.domain, entry)
}

export function getEntryBySlug(slug: string): SiteEntry | undefined {
  return bySlug.get(slug)
}

export function getEntryByDomain(domain: string): SiteEntry | undefined {
  return byDomain.get(domain)
}

export function getEntriesBySection(section: string): SiteEntry[] {
  return entries.filter((e) => e.section === section)
}
