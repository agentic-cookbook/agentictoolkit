import { afterEach, describe, expect, it } from 'vitest'
import { configureData } from '../config'
import { readLastId, writeLastId, writeViewMode } from '../ftd-storage'

afterEach(() => {
  localStorage.clear()
  // Restore the default so one test's override can't leak into the next.
  configureData({ storageKeyPrefix: 'adh' })
})

describe('ftd-storage key prefix', () => {
  it('defaults to the unchanged "adh:ftd:…" key shape', () => {
    writeLastId('/ecosystems', 'eco-1')
    expect(localStorage.getItem('adh:ftd:/ecosystems:lastId')).toBe('eco-1')
    writeViewMode('/ecosystems', 'list')
    expect(localStorage.getItem('adh:ftd:/ecosystems:viewMode')).toBe('list')
  })

  it('respects a configured storageKeyPrefix override', () => {
    configureData({ storageKeyPrefix: 'acme' })
    writeLastId('/teams', 'team-9')
    expect(localStorage.getItem('acme:ftd:/teams:lastId')).toBe('team-9')
    expect(localStorage.getItem('adh:ftd:/teams:lastId')).toBeNull()
    // The read side uses the same configured prefix, so it round-trips.
    expect(readLastId('/teams')).toBe('team-9')
  })
})
