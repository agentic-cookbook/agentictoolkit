'use client'

import { Link } from 'react-router'
import { useContent } from '../../contexts/ContentContext'
import type { SiteEntry, NavNode } from '../../types'

interface SectionIndexProps {
  section: string
  title: string
}

function EntryCard({ entry }: { entry: SiteEntry }) {
  return (
    <Link
      to={entry.slug}
      className="group block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)] transition-all duration-200"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
          {entry.frontmatter.title}
        </h3>
      </div>
      {entry.frontmatter.summary && (
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-2">
          {entry.frontmatter.summary}
        </p>
      )}
    </Link>
  )
}

function SubsectionGroup({ label, entries }: { label: string; entries: SiteEntry[] }) {
  return (
    <div>
      <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-display)' }}>
        {label}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <EntryCard key={entry.slug} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function findNode(nodes: NavNode[], path: string): NavNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const found = findNode(node.children, path)
    if (found) return found
  }
  return undefined
}

function collectEntries(
  node: NavNode,
  getBySlug: (slug: string) => SiteEntry | undefined,
): SiteEntry[] {
  const results: SiteEntry[] = []
  for (const child of node.children) {
    if (child.children.length > 0) {
      results.push(...collectEntries(child, getBySlug))
    } else {
      const entry = getBySlug(child.path)
      if (entry) results.push(entry)
    }
  }
  return results
}

function countAllEntries(
  node: NavNode,
  getBySlug: (slug: string) => SiteEntry | undefined,
): number {
  let count = 0
  for (const child of node.children) {
    if (child.children.length > 0) {
      count += countAllEntries(child, getBySlug)
    } else if (getBySlug(child.path)) {
      count++
    }
  }
  return count
}

export default function SectionIndex({ section, title }: SectionIndexProps) {
  const { navTree, getBySlug } = useContent()
  const path = '/' + section
  const sectionNode = findNode(navTree, path)
  if (!sectionNode) return null

  const groups: { label: string; entries: SiteEntry[] }[] = []
  const topLevelEntries: SiteEntry[] = []

  for (const child of sectionNode.children) {
    if (child.children.length > 0) {
      const entries = collectEntries(child, getBySlug)
      if (entries.length > 0) groups.push({ label: child.label, entries })
    } else {
      const entry = getBySlug(child.path)
      if (entry) topLevelEntries.push(entry)
    }
  }

  return (
    <div className="px-6 py-10 lg:px-10 max-w-5xl">
      <div className="mb-10">
        <h1
          className="text-4xl lg:text-5xl mb-3 tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        <p className="font-mono text-sm text-[var(--color-text-dim)]">
          {countAllEntries(sectionNode, getBySlug)} documents
        </p>
      </div>
      <div className="flex flex-col gap-10">
        {topLevelEntries.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topLevelEntries.map((entry) => (
              <EntryCard key={entry.slug} entry={entry} />
            ))}
          </div>
        )}
        {groups.map(({ label, entries }) => (
          <SubsectionGroup key={label} label={label} entries={entries} />
        ))}
      </div>
    </div>
  )
}
