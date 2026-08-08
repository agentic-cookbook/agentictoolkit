import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readRecents, recordRecent, clearRecents, RECENTS_CAP } from '../recents'

// The Recents store — the settle-recorded, on-device history behind the menu's
// Recents flyout. These cover the store's contract (recipe test vectors T9 + T11):
// newest-first, de-dupe by URL, cap + eviction, and persistence across a reload.

describe('recents store', () => {
  beforeEach(() => {
    localStorage.clear()
    clearRecents() // reset the in-memory snapshot too
  })

  it('records newest-first', () => {
    recordRecent({ url: '/a', label: 'A' })
    recordRecent({ url: '/b', label: 'B' })
    expect(readRecents().map((r) => r.url)).toEqual(['/b', '/a'])
  })

  it('de-dupes by url, moving an existing place to the front with its new label (T9)', () => {
    recordRecent({ url: '/a', label: 'A' })
    recordRecent({ url: '/b', label: 'B' })
    recordRecent({ url: '/a', label: 'A (updated)' })
    expect(readRecents().map((r) => r.url)).toEqual(['/a', '/b'])
    expect(readRecents()[0]?.label).toBe('A (updated)')
  })

  it('caps at RECENTS_CAP, evicting the oldest (T9)', () => {
    for (let i = 0; i < RECENTS_CAP + 3; i++) recordRecent({ url: `/p${i}`, label: `P${i}` })
    const list = readRecents()
    expect(list).toHaveLength(RECENTS_CAP)
    expect(list[0]?.url).toBe(`/p${RECENTS_CAP + 2}`) // newest kept
    expect(list.some((r) => r.url === '/p0')).toBe(false) // oldest evicted
  })

  it('stamps each entry with a numeric ts, and carries the row fields through', () => {
    recordRecent({ url: '/a', label: 'A', description: 'Personas · Bob', iconKey: '/personas' })
    const first = readRecents()[0]
    expect(typeof first?.ts).toBe('number')
    // Both are opaque here — the store neither resolves the icon key nor reads the
    // tagline — but both have to survive the round trip through localStorage, which
    // is the only reason they are asserted at this level at all.
    expect(first?.iconKey).toBe('/personas')
    expect(first?.description).toBe('Personas · Bob')
  })

  it('persists to localStorage and re-hydrates on a fresh load (T11)', async () => {
    recordRecent({ url: '/a', label: 'A' })
    // A reload = a fresh module instance hydrating its snapshot from localStorage.
    vi.resetModules()
    const fresh = await import('../recents')
    expect(fresh.readRecents().map((r) => r.url)).toEqual(['/a'])
  })

  it('clearRecents empties the list', () => {
    recordRecent({ url: '/a', label: 'A' })
    clearRecents()
    expect(readRecents()).toEqual([])
  })
})
