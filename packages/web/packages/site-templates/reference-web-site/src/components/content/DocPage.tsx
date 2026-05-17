'use client'

import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useContent } from '../../contexts/ContentContext'
import { useSiteConfig } from '../../contexts/SiteConfigContext'
import Breadcrumbs from '../layout/Breadcrumbs'
import TableOfContents from '../layout/TableOfContents'
import HomePage from '../sections/HomePage'
import SectionIndex from '../sections/SectionIndex'
import type { NavNode } from '../../types'

function findNavNode(nodes: NavNode[], path: string): NavNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const found = findNavNode(node.children, path)
    if (found) return found
  }
  return undefined
}

export default function DocPage() {
  const { pathname, hash } = useLocation()
  const { getBySlug, navTree } = useContent()
  const config = useSiteConfig()
  const tocEnabled = config.features?.toc !== false

  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const timer = setTimeout(() => {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timer)
  }, [pathname, hash])

  const slug = pathname === '/' ? '/' : pathname.replace(/\/$/, '')

  if (slug === '/') {
    return <HomePage />
  }

  const RouteOverride = config.slots?.routeOverrides?.[slug]
  if (RouteOverride) {
    return <RouteOverride />
  }

  const sectionConfig = config.nav.sections.find((s) => s.path === slug)
  if (sectionConfig) {
    return <SectionIndex section={sectionConfig.key} title={sectionConfig.label} />
  }

  const entry = getBySlug(slug)

  if (!entry) {
    const dirNode = findNavNode(navTree, slug)
    if (dirNode && dirNode.children.length > 0) {
      return <SectionIndex section={slug.replace(/^\//, '')} title={dirNode.label} />
    }
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <h1
            className="text-2xl text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Page not found
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            No content at{' '}
            <code className="text-sm bg-[var(--color-surface-raised)] px-1.5 py-0.5 rounded font-mono">
              {pathname}
            </code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className="flex-1 min-w-0 px-6 py-8 lg:px-10 max-w-3xl">
        <Breadcrumbs slug={entry.slug} />
        <article
          className="prose max-w-none prose-headings:scroll-mt-20 prose-code:before:content-none prose-code:after:content-none"
          dangerouslySetInnerHTML={{ __html: entry.html }}
        />
      </div>
      {tocEnabled && <TableOfContents headings={entry.headings} />}
    </div>
  )
}
