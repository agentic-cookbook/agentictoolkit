// The hub workspace rail's GROUPS — the site menu's own topics, read as a grouping of the hub
// routes those topics point at.
//
// The rail used to list all 45 fleet segments flat, alphabetically, which is a list you scan
// rather than read. The site menu had already answered "where does this thing live?" for every
// one of them — Plan, Build, Personas, Products, Hire — so the rail asks THAT question here
// instead of being handed a second grouping to keep level with it. Change a row's group in
// {@link FLEET_MENU_GROUPS} and the rail follows on the next render; add a site to the registry
// with a menu row and it arrives in the rail's right group with nothing else edited.
//
// What this module does NOT decide: the hub's own knobs (tokens, applications, Settings — the
// segments with no site behind them) have no menu row, so nothing here can place them. The hub
// states their group beside its own rows, and appends its Configuration group, which the family
// menu has no equivalent of.
//
// ⚠️ Two facts about the menu tree are load-bearing here, and both are stated in
// `fleetMenuGroups.ts` rather than invented:
//   - a topic's `link` is a member of its own group (Products ▸ Products), not a separate thing;
//   - the three PROMOTED top-level rows (bitbag, messages, orgs) have no group of their own,
//     and the registry files them under Hub (see SITE_CATEGORIES' first entry, which says so in
//     as many words). That is where their segments land here.

import {
  hubFeatureSegment, SITE_FOR_HUB_SEGMENT,
  type HubFeatureSegment, type SiteId,
} from '@agentic-toolkit/adh-registry'
import { FLEET_MENU_GROUPS } from './fleetMenuGroups'
import type { MenuLink } from './SiteMenu'

/** One group row on the hub's workspace rail, and the feature segments it discloses. */
export interface HubRailGroup {
  /** Stable rail id. Namespaced with `group:` so the group space and the SEGMENT space are
   *  provably disjoint — a rail level holds one or the other, and `products` names a group AND a
   *  feature. No URL carries it; it exists only as the rail's selection key. */
  id: string
  label: string
  description?: string
  /** A {@link menuIcon} key — the topic's own `iconKey`, else the site its trigger links to. */
  iconKey?: string
  /** The hub segments this group discloses, in the menu's own order. */
  segments: HubFeatureSegment[]
}

/** The group the promoted top-level menu rows belong to. See the module comment. */
const PROMOTED_GROUP_LABEL = 'Hub'

/** The trailing group for a segment no menu topic claims — the same guarantee
 *  `groupSitesByCategory` gives the footer's overview: a new site is never silently dropped off
 *  the rail because nobody remembered to give it a menu row. Empty in practice today. */
const LEFTOVER_GROUP_LABEL = 'More'

function siteOf(link: MenuLink): SiteId | undefined {
  return 'site' in link ? link.site : undefined
}

/** The segment a menu link leads to in the hub, or undefined when it leads somewhere the hub has
 *  no workspace route for (a `{ route }` or `{ href }` row, or a site with no hub route: bitbag,
 *  status, hub-help, personaregistry, myagenticteams). */
function segmentOf(link: MenuLink): HubFeatureSegment | undefined {
  const site = siteOf(link)
  return site ? hubFeatureSegment(site) : undefined
}

function railGroupId(label: string): string {
  return `group:${label.toLowerCase()}`
}

/** The Hub group's rail id, named so a host can PLACE that group rather than only read it out of
 *  the derived list. The hub's rail draws it at the tail — last row above Settings, under a
 *  divider — because it is the family's own front door (Help, Support, the two registries, the
 *  Academy) rather than an area of anyone's work, and the tail is where the rows about the
 *  product-you-are-using-rather-than-the-work-you-are-doing belong.
 *
 *  Derived from the label rather than written as the literal `'group:hub'`, so the two cannot
 *  disagree about the namespacing rule {@link railGroupId} owns. */
export const HUB_PROMOTED_GROUP_ID: string = railGroupId(PROMOTED_GROUP_LABEL)

/**
 * The fleet's groups, in the menu's order, each carrying the hub segments its rows lead to.
 *
 * Derived at module load from {@link FLEET_MENU_GROUPS}: a constant identity, like the tree it
 * reads, so a rail that memoizes on it never re-derives.
 *
 * A segment claimed by two groups goes to the FIRST — the same rule `groupSitesByCategory` uses
 * on the footer's side of this grouping. Nothing claims one twice today; the rule is here so
 * that when something does, the row appears once in a stated place rather than twice.
 */
export const HUB_RAIL_GROUPS: HubRailGroup[] = (() => {
  const groups: HubRailGroup[] = []
  const byLabel = new Map<string, HubRailGroup>()
  const claimed = new Set<HubFeatureSegment>()

  const group = (label: string, seed?: { description?: string; iconKey?: string }): HubRailGroup => {
    const existing = byLabel.get(label)
    if (existing) return existing
    const made: HubRailGroup = { id: railGroupId(label), label, ...seed, segments: [] }
    byLabel.set(label, made)
    groups.push(made)
    return made
  }

  const claim = (into: HubRailGroup, link: MenuLink | undefined): void => {
    const segment = link && segmentOf(link)
    if (segment === undefined || claimed.has(segment)) return
    claimed.add(segment)
    into.segments.push(segment)
  }

  for (const entry of FLEET_MENU_GROUPS) {
    if (entry.kind === 'topic') {
      // The glyph the menu's own trigger wears: its `iconKey` when it names one (the grouping
      // headers, and Learn, which deliberately does not wear its site's mark), else the site it
      // links to. Resolved by the caller through `menuIcon`, so the two surfaces cannot diverge.
      const iconKey = entry.iconKey ?? (entry.link ? siteOf(entry.link) : undefined)
      const into = group(entry.label, { description: entry.description, iconKey })
      // The trigger first: a topic that IS a site (Products, Personas, Hub) offers that site's
      // own feature, and it reads as the group's first row rather than as a row about the group.
      claim(into, entry.link)
      for (const link of entry.links) claim(into, link)
      continue
    }
    // 'leaf' / 'inline' — a promoted row with no group of its own.
    claim(group(PROMOTED_GROUP_LABEL), entry.link)
  }

  // Totality. Anything the tree never named still gets a row; see LEFTOVER_GROUP_LABEL.
  const everySegment = Object.keys(SITE_FOR_HUB_SEGMENT) as HubFeatureSegment[]
  const leftover = everySegment.filter((s) => !claimed.has(s))
  if (leftover.length) group(LEFTOVER_GROUP_LABEL).segments.push(...leftover)

  return groups.filter((g) => g.segments.length > 0)
})()

/** The group each hub feature segment belongs to, by group id — the reverse of the list above,
 *  which is the direction the rail asks in (it holds the segment the URL names and needs the
 *  group to open). */
export const HUB_RAIL_GROUP_FOR_SEGMENT: Record<HubFeatureSegment, string> = (() => {
  const out = {} as Record<HubFeatureSegment, string>
  for (const group of HUB_RAIL_GROUPS) {
    for (const segment of group.segments) out[segment] = group.id
  }
  return out
})()
