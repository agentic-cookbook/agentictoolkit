import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// The dev site-family submenus: two flyout topics whose `external` links must
// resolve to the actual site deployment even from an in-hub workspace route (where
// a plain site link resolves to the /<slug>/<feature> view instead). This file
// covers the pure buildDebugSiteGroups() CONTENTS; the gate (dev-env build OR the
// signed-in-admin unlock) is DevToolsMenu's `unlocked`, covered in
// devToolsMenu.test.tsx, whose build-flag leg (DEV_TOOLS_BUILD_ENABLED) is covered
// in devToolsEntries.test.ts.

// Mock a hub WORKSPACE route so useSiteMenu enters in-hub mode (workspaceSlug set).
vi.mock('next/navigation', () => ({
  usePathname: () => '/acme/ecosystems',
  useRouter: () => ({ push: vi.fn() }),
}))

import { buildDebugSiteGroups } from '../debugSiteGroups'
import { useSiteMenu } from '../useSiteMenu'
import { MAIN_SITE_IDS, MARKETING_SITE_IDS } from '@agentic-toolkit/adh-registry'
import { type PopoverEntry } from '@agentic-toolkit/adh/header'

const topic = (entries: PopoverEntry[], label: string) =>
  entries.find((e): e is Extract<PopoverEntry, { kind: 'topic' }> => e.kind === 'topic' && e.label === label)

describe('buildDebugSiteGroups', () => {
  it('builds the Marketing + Main flyouts, each listing its whole family as external links', () => {
    const groups = buildDebugSiteGroups()
    expect(groups.map((g) => g.kind)).toEqual(['topic', 'topic'])
    const [marketing, main] = groups as Extract<(typeof groups)[number], { kind: 'topic' }>[]
    expect(marketing!.label).toBe('Marketing sites')
    expect(main!.label).toBe('Main sites')
    // Each topic lists EXACTLY its own family's ids, in order — so a swapped array,
    // a dropped/renamed id, or a mis-mapped link is caught (not just a coincidental
    // length match).
    expect(marketing!.links.map((l) => ('site' in l ? l.site : null))).toEqual([...MARKETING_SITE_IDS])
    expect(main!.links.map((l) => ('site' in l ? l.site : null))).toEqual([...MAIN_SITE_IDS])
    // Every link opts out of in-hub resolution (opens the real deployment)...
    expect(marketing!.links.every((l) => 'site' in l && l.external === true)).toBe(true)
    expect(main!.links.every((l) => 'site' in l && l.external === true)).toBe(true)
    // ...and both share one section, so a single divider precedes the pair.
    expect(main!.section).toBe(marketing!.section)
  })
})

describe('external site links from an in-hub workspace route', () => {
  it('resolve to the cross-site deployment, not the /<slug>/<feature> view', () => {
    const { result } = renderHook(() => useSiteMenu(buildDebugSiteGroups(), { currentSiteId: 'hub' }))
    const marketing = topic(result.current.entries, 'Marketing sites')
    const eco = marketing?.items.find((i) => i.key === 'ecosystems')
    // A plain (non-external) ecosystems link here would be the in-hub '/acme/ecosystems';
    // `external` forces the actual site build instead (an absolute cross-site URL).
    expect(eco?.href).toBeDefined()
    expect(eco?.href?.startsWith('/acme/')).toBe(false)
    expect(eco?.href).toMatch(/^https?:\/\//)
  })
})
