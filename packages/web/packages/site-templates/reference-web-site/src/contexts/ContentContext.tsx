'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  entries,
  getEntryBySlug,
  getEntryByDomain,
  getEntriesBySection,
} from '../lib/manifest'
import { buildNavTree } from '../lib/navigation'
import type { SiteEntry, NavNode } from '../types'
import { useSiteConfig } from './SiteConfigContext'

interface ContentContextValue {
  entries: SiteEntry[]
  navTree: NavNode[]
  getBySlug: (slug: string) => SiteEntry | undefined
  getByDomain: (domain: string) => SiteEntry | undefined
  getBySection: (section: string) => SiteEntry[]
}

const ContentContext = createContext<ContentContextValue | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const config = useSiteConfig()
  const value = useMemo<ContentContextValue>(
    () => ({
      entries,
      navTree: buildNavTree(entries, config.nav.sections),
      getBySlug: getEntryBySlug,
      getByDomain: getEntryByDomain,
      getBySection: getEntriesBySection,
    }),
    [config.nav.sections],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within a ContentProvider')
  return ctx
}
