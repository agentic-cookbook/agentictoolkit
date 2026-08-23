import { describe, expect, it } from 'vitest'
import {
  HUB_FEATURE_SEGMENT,
  SITE_FOR_HUB_SEGMENT,
  hubFeatureSegment,
  type HubFeatureSegment,
} from '@agentic-toolkit/adh-registry'
import { FLEET_MENU_GROUPS } from '../fleetMenuGroups'
import { HUB_RAIL_GROUPS, HUB_RAIL_GROUP_FOR_SEGMENT } from '../hub-rail-groups'

const labels = HUB_RAIL_GROUPS.map((g) => g.label)
const byLabel = (label: string) => HUB_RAIL_GROUPS.find((g) => g.label === label)

describe('HUB_RAIL_GROUPS', () => {
  it('is the site menu topics, in the menu order', () => {
    // Not a hand-copied list checked against a hand-copied list: the expectation is READ from the
    // tree, so a menu topic added, renamed or reordered moves both sides together. What is pinned
    // is the derivation — every topic becomes a group, in place, and nothing else does.
    const topics = FLEET_MENU_GROUPS.filter((g) => g.kind === 'topic').map((g) => g.label)
    expect(labels).toEqual(['Hub', ...topics.filter((t) => t !== 'Hub')])
  })

  it('reads as the family, not as a derivation artefact', () => {
    // The one hard-coded expectation, and the reason: this list is what a signed-in user reads
    // down the rail. A change here is a change to the hub's information architecture and should
    // be a deliberate edit of the menu, not a side effect of one.
    expect(labels).toEqual(['Hub', 'Learn', 'Plan', 'Build', 'Personas', 'Products', 'Hire'])
  })

  it('places every hub feature segment in exactly one group', () => {
    const every = Object.keys(SITE_FOR_HUB_SEGMENT) as HubFeatureSegment[]
    const placed = HUB_RAIL_GROUPS.flatMap((g) => g.segments)
    expect([...placed].sort()).toEqual([...every].sort())
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('files the promoted top-level rows under Hub', () => {
    // bitbag has no hub route, so only two of the three leaves contribute a segment.
    const hub = byLabel('Hub')!.segments
    expect(hub).toContain(hubFeatureSegment('messages'))
    expect(hub).toContain(hubFeatureSegment('orgs'))
  })

  it('opens a group with the site its own trigger links to', () => {
    // Products ▸ Products, Personas ▸ Personas — the trigger is a member of its group, first.
    expect(byLabel('Products')!.segments[0]).toBe(HUB_FEATURE_SEGMENT.products)
    expect(byLabel('Personas')!.segments[0]).toBe(HUB_FEATURE_SEGMENT.personas)
  })

  it('carries the glyph key the menu trigger wears', () => {
    expect(byLabel('Plan')!.iconKey).toBe('plan')
    expect(byLabel('Build')!.iconKey).toBe('build')
    expect(byLabel('Learn')!.iconKey).toBe('learn')
    expect(byLabel('Products')!.iconKey).toBe('products')
  })

  it('namespaces group ids away from the segment space', () => {
    for (const group of HUB_RAIL_GROUPS) {
      expect(group.id.startsWith('group:')).toBe(true)
      expect(group.id in SITE_FOR_HUB_SEGMENT).toBe(false)
    }
    expect(new Set(HUB_RAIL_GROUPS.map((g) => g.id)).size).toBe(HUB_RAIL_GROUPS.length)
  })

  it('reverses into HUB_RAIL_GROUP_FOR_SEGMENT', () => {
    for (const group of HUB_RAIL_GROUPS) {
      for (const segment of group.segments) {
        expect(HUB_RAIL_GROUP_FOR_SEGMENT[segment]).toBe(group.id)
      }
    }
    expect(Object.keys(HUB_RAIL_GROUP_FOR_SEGMENT).length).toBe(
      Object.keys(SITE_FOR_HUB_SEGMENT).length,
    )
  })
})
