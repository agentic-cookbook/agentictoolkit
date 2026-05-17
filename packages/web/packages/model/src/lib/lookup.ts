import type { SiteEntry } from '../types'

export function findBySlug(entries: SiteEntry[], slug: string): SiteEntry | undefined {
  return entries.find((e) => e.slug === slug)
}

export function getBySection(entries: SiteEntry[], section: string): SiteEntry[] {
  return entries.filter((e) => e.section === section)
}

export function getByDomain(entries: SiteEntry[], domain: string): SiteEntry[] {
  return entries.filter((e) => e.domain === domain)
}
