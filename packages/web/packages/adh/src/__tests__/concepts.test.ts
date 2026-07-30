import { describe, it, expect } from 'vitest'
import {
  conceptTree,
  conceptById,
  conceptIds,
  getConcept,
  ancestorsOf,
  childrenOf,
  relatedOf,
  conceptForSite,
  conceptByDoc,
  detailTopics,
  detailsParamsForSite,
  hasDetailPage,
  CONCEPT_SITE_IDS,
  type ConceptNode,
} from '../concepts'
import { getSite, type SiteId } from '@agentic-toolkit/adh-registry'
import { helpSlugs } from '@agentic-toolkit/adh/help/surface'

// The marketing sites that adopt the shared concept-graph landing. Keep in sync
// with the rollout list; the tree must focus a node for each.
const TARGET_SITES: SiteId[] = [
  'academy', 'authentication', 'billing', 'communities', 'community', 'consulting',
  'customers', 'dashboards', 'devices', 'domains', 'ecosystems', 'education',
  'knowledgebases', 'narratives', 'news', 'notifications', 'personas', 'products',
  'projects', 'recipes', 'registries', 'sites', 'storage', 'support', 'tools',
  'teamregistry', 'teambuilder', 'codereviews', 'personabuilder', 'research',
  'consultants',
]

function flatten(node: ConceptNode): ConceptNode[] {
  return [node, ...(node.children ?? []).flatMap(flatten)]
}
const allNodes = flatten(conceptTree)

describe('concept tree integrity', () => {
  it('has globally unique node ids', () => {
    const ids = allNodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(conceptIds.size).toBe(ids.length)
  })

  it('every node has a label and a blurb', () => {
    for (const n of allNodes) {
      expect(n.label.length, `${n.id} label`).toBeGreaterThan(0)
      expect(n.blurb.length, `${n.id} blurb`).toBeGreaterThan(0)
    }
  })

  it('every siteId on a node is a real registry site', () => {
    for (const n of allNodes) {
      if (n.siteId) expect(getSite(n.siteId), `${n.id} → ${n.siteId}`).toBeDefined()
    }
  })

  it('every related[] id resolves to a node', () => {
    for (const n of allNodes) {
      for (const rid of n.related ?? []) {
        expect(getConcept(rid), `${n.id} related → ${rid}`).toBeDefined()
      }
    }
  })
})

describe('site coverage', () => {
  it('focuses exactly one node per target site', () => {
    for (const site of TARGET_SITES) {
      const node = conceptForSite(site)
      expect(node, `${site} must map to a concept node`).toBeDefined()
      const matches = allNodes.filter((n) => n.siteId === site)
      expect(matches.length, `${site} mapped more than once`).toBe(1)
    }
  })

  it('CONCEPT_SITE_IDS matches the tree siteIds and the target list', () => {
    const treeSiteIds = new Set(allNodes.map((n) => n.siteId).filter(Boolean))
    expect(new Set(CONCEPT_SITE_IDS)).toEqual(treeSiteIds)
    expect(new Set(CONCEPT_SITE_IDS)).toEqual(new Set(TARGET_SITES))
  })

  it('every site node carries a details page', () => {
    for (const site of TARGET_SITES) {
      const node = conceptForSite(site)!
      expect(hasDetailPage(node), `${site} needs detail content`).toBe(true)
      expect(detailsParamsForSite(site).length, `${site} details params`).toBeGreaterThan(0)
    }
  })
})

describe('graph helpers', () => {
  it('concepts + the root are graph-only (no details page)', () => {
    expect(hasDetailPage(conceptTree)).toBe(false)
    for (const concept of childrenOf('hub')) {
      expect(hasDetailPage(concept), `${concept.id} concept should be graph-only`).toBe(false)
    }
  })

  it('detailTopics are exactly the nodes with detail content', () => {
    expect(detailTopics.every(hasDetailPage)).toBe(true)
    expect(detailTopics.length).toBe(allNodes.filter(hasDetailPage).length)
  })

  it('builds a root→node breadcrumb chain', () => {
    const chain = ancestorsOf('customer-lifecycle').map((n) => n.id)
    expect(chain).toEqual(['hub', 'sell', 'customers'])
  })

  it('resolves related nodes', () => {
    const related = relatedOf('customers').map((n) => n.id)
    expect(related).toContain('products')
    expect(related).toContain('billing')
  })

  it('conceptById round-trips', () => {
    expect(conceptById.get('personas')?.label).toBe('Personas')
    expect(conceptById.get('forums')?.siteId).toBe('community')
  })
})

describe('docs linkage', () => {
  it('resolves a node by its docs slug (reverse of node.docs)', () => {
    expect(conceptByDoc('quickstart/oauth/overview')?.id).toBe('authentication')
  })

  it('every docs slug is non-empty and maps to at most one node', () => {
    const slugs = allNodes.map((n) => n.docs).filter((s): s is string => Boolean(s))
    expect(new Set(slugs).size, 'docs slugs must be unique').toBe(slugs.length)
    for (const s of slugs) expect(s.trim().length, `docs slug "${s}"`).toBeGreaterThan(0)
  })

  // The one check validate-content.py can't make: it is pure Python over the JSON and
  // the help catalog is TypeScript, so it only asserts `docs` is non-empty (its docstring
  // routes checks needing the TS side here). DetailsPage renders `docs` as a link into
  // site `hub-help`, whose routes ARE helpSlugs() — so an unresolvable slug is a 404 on
  // a live /details page, and nothing else in the repo would catch it.
  it('every docs slug resolves to a real help topic', () => {
    const slugs = new Set(helpSlugs())
    for (const n of allNodes) {
      if (!n.docs) continue
      expect(slugs.has(n.docs), `${n.id} docs -> unknown help slug "${n.docs}"`).toBe(true)
    }
  })
})
