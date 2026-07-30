import { describe, it, expect } from 'vitest'
import { conceptTree } from '../concepts'
import {
  decompose,
  assembleTree,
  getLocale,
  DEFAULT_LOCALE,
} from '../concepts/assemble'
import type { ConceptNode } from '../concepts/types'

function flatten(node: ConceptNode): ConceptNode[] {
  return [node, ...(node.children ?? []).flatMap(flatten)]
}

describe('structure/content assembly', () => {
  it('decompose∘assemble is the identity on the live tree', () => {
    const { structure, content } = decompose(conceptTree)
    const rebuilt = assembleTree(structure, { [DEFAULT_LOCALE]: content })
    expect(rebuilt).toEqual(conceptTree)
  })

  it('decomposed structure carries no human copy', () => {
    const { structure } = decompose(conceptTree)
    const walk = (n: Record<string, unknown>): void => {
      for (const banned of ['label', 'kicker', 'blurb', 'detail', 'keyPoints', 'ctas']) {
        expect(n, `structure node ${String(n.id)} must not carry ${banned}`).not.toHaveProperty(
          banned,
        )
      }
      for (const c of (n.children as Record<string, unknown>[] | undefined) ?? []) walk(c)
    }
    walk(structure as unknown as Record<string, unknown>)
  })

  it('decomposed content is keyed by node id and covers every node', () => {
    const { content } = decompose(conceptTree)
    const ids = flatten(conceptTree).map((n) => n.id)
    expect(Object.keys(content).sort()).toEqual([...ids].sort())
    for (const n of flatten(conceptTree)) {
      expect(content[n.id]?.label, `${n.id} label`).toBe(n.label)
      expect(content[n.id]?.blurb, `${n.id} blurb`).toBe(n.blurb)
    }
  })

  it('falls back to the default locale when the active locale omits a node', () => {
    const { structure, content } = decompose(conceptTree)
    // Active locale is empty ⇒ everything must fall back to the default catalog.
    const rebuilt = assembleTree(structure, { [DEFAULT_LOCALE]: content }, getLocale())
    expect(rebuilt).toEqual(conceptTree)
  })
})
