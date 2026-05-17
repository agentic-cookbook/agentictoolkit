import type { SiteEntry, NavNode, NavSectionConfig } from '../types'

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function buildNavTree(
  entries: SiteEntry[],
  sections: NavSectionConfig[],
): NavNode[] {
  const sectionMap = new Map<string, NavNode>()
  const sectionOrder: string[] = []

  for (const section of sections) {
    sectionMap.set(section.key, {
      label: section.label,
      path: section.path,
      children: [],
    })
    sectionOrder.push(section.key)
  }

  for (const entry of entries) {
    if (!entry.section || entry.slug === '/') continue

    let sectionNode = sectionMap.get(entry.section)
    if (!sectionNode) {
      sectionNode = {
        label: titleCase(entry.section),
        path: '/' + entry.section,
        children: [],
      }
      sectionMap.set(entry.section, sectionNode)
      sectionOrder.push(entry.section)
    }

    const parts = entry.slug.split('/').filter(Boolean)
    const pathWithinSection = parts.slice(1)

    if (pathWithinSection.length === 0) {
      sectionNode.domain = entry.domain
      continue
    }

    let current = sectionNode
    for (let i = 0; i < pathWithinSection.length - 1; i++) {
      const segment = pathWithinSection[i]
      if (!segment) continue
      let child = current.children.find(
        (c) => c.label === titleCase(segment) && c.children.length > 0,
      )
      if (!child) {
        child = {
          label: titleCase(segment),
          path: '/' + parts.slice(0, i + 2).join('/'),
          children: [],
        }
        current.children.push(child)
      }
      current = child
    }

    current.children.push({
      label: entry.frontmatter.title,
      path: entry.slug,
      domain: entry.domain,
      children: [],
    })
  }

  function sortChildren(node: NavNode) {
    node.children.sort((a, b) => {
      if (a.children.length > 0 && b.children.length === 0) return -1
      if (a.children.length === 0 && b.children.length > 0) return 1
      return a.label.localeCompare(b.label)
    })
    for (const child of node.children) sortChildren(child)
  }

  const tree = sectionOrder
    .map((key) => sectionMap.get(key)!)
    .filter(Boolean)

  for (const node of tree) sortChildren(node)
  return tree
}
