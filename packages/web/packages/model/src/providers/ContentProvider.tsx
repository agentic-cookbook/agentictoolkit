'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SiteEntry, NavNode } from '../types'
import { useSiteConfig } from './SiteConfigProvider'
import { buildNavTree } from '../lib/nav'
import { findBySlug, getBySection, getByDomain } from '../lib/lookup'
import { createSearchIndex, type SearchIndex } from '../lib/search'

export type ContentValue = {
  entries: SiteEntry[]
  navTree: NavNode[]
  searchIndex: SearchIndex
  findBySlug: (slug: string) => SiteEntry | undefined
  getBySection: (section: string) => SiteEntry[]
  getByDomain: (domain: string) => SiteEntry[]
}

const ContentContext = createContext<ContentValue | null>(null)

export function ContentProvider({ entries, children }: { entries: SiteEntry[]; children: ReactNode }) {
  const config = useSiteConfig()
  const value = useMemo<ContentValue>(() => {
    const navTree = buildNavTree(entries, config.nav.sections)
    const searchIndex = createSearchIndex(entries)
    return {
      entries,
      navTree,
      searchIndex,
      findBySlug: (slug) => findBySlug(entries, slug),
      getBySection: (section) => getBySection(entries, section),
      getByDomain: (domain) => getByDomain(entries, domain),
    }
  }, [entries, config.nav.sections])
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent(): ContentValue {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used inside <ContentProvider>')
  return ctx
}
