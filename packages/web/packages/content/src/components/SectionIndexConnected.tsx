'use client'

import { useContent } from '@agentic-web-toolkit/model'
import type { NavNode, SiteEntry } from '@agentic-web-toolkit/model'
import { SectionIndex, type SubsectionGroup } from './SectionIndex'

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
  const out: SiteEntry[] = []
  for (const child of node.children) {
    if (child.children.length > 0) {
      out.push(...collectEntries(child, getBySlug))
    } else {
      const e = getBySlug(child.path)
      if (e) out.push(e)
    }
  }
  return out
}

export type SectionIndexConnectedProps = {
  sectionPath: string
  title: string
}

export function SectionIndexConnected({ sectionPath, title }: SectionIndexConnectedProps) {
  const { navTree, findBySlug } = useContent()
  const sectionNode = findNode(navTree, sectionPath)
  if (!sectionNode) return null

  const groups: SubsectionGroup[] = []
  const topLevelEntries: SiteEntry[] = []
  for (const child of sectionNode.children) {
    if (child.children.length > 0) {
      const entries = collectEntries(child, findBySlug)
      if (entries.length > 0) groups.push({ label: child.label, entries })
    } else {
      const e = findBySlug(child.path)
      if (e) topLevelEntries.push(e)
    }
  }
  return <SectionIndex title={title} topLevelEntries={topLevelEntries} groups={groups} />
}
