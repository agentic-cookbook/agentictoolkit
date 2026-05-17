import { visit } from 'unist-util-visit'
import type { Root, Element } from 'hast'

interface Options {
  domainMap: Map<string, string>
  prefixes: string[]
}

export function rehypeCrossReferences(options: Options) {
  const { domainMap, prefixes } = options

  if (prefixes.length === 0) {
    return () => {}
  }

  const prefixPattern = new RegExp(
    `^(${prefixes.map(escapeRegex).join('|')})\\.[\\w.-]+$`,
  )

  function resolveDomain(domain: string): string | null {
    if (domainMap.has(domain)) return domainMap.get(domain)!
    for (const [knownDomain, slug] of domainMap) {
      if (knownDomain.endsWith('.' + domain.split('.').slice(-2).join('.'))) {
        return slug
      }
    }
    return null
  }

  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      if (
        node.tagName !== 'code' ||
        !parent ||
        (parent as Element).tagName === 'pre'
      ) {
        return
      }
      const textChild = node.children[0]
      if (!textChild || textChild.type !== 'text') return

      const text = textChild.value
      if (!prefixPattern.test(text)) return

      const resolved = resolveDomain(text)
      if (resolved) {
        const link: Element = {
          type: 'element',
          tagName: 'a',
          properties: { href: resolved, className: ['cross-ref'] },
          children: [{ type: 'text', value: text }],
        }
        Object.assign(node, link)
      } else {
        node.properties = {
          ...node.properties,
          'data-unresolved': 'true',
          className: ['cross-ref-unresolved'],
        }
      }
    })
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
