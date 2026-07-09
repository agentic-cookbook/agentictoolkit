import { describe, it, expect } from 'vitest'
import { isRowDirty, mergeDraft } from '../edits'

describe('isRowDirty', () => {
  it('is clean when there are no staged edits', () => {
    expect(isRowDirty({ name: 'Pro' }, undefined)).toBe(false)
    expect(isRowDirty({ name: 'Pro' }, {})).toBe(false)
  })

  it('is clean when every edit equals its baseline (typed back to original)', () => {
    expect(isRowDirty({ name: 'Pro', active: true }, { name: 'Pro', active: true })).toBe(false)
  })

  it('is dirty when an edit differs from its baseline', () => {
    expect(isRowDirty({ name: 'Pro' }, { name: 'Pro Plus' })).toBe(true)
  })

  it('is dirty when a draft fills a blank-default column', () => {
    // A create draft's baseline is blank ('' / undefined); typing any value dirties it.
    expect(isRowDirty({ name: '', enabled: undefined }, { name: 'New' })).toBe(true)
    expect(isRowDirty({ name: '', enabled: undefined }, { enabled: false })).toBe(true)
  })

  it('only the changed column matters (edits carry just the delta)', () => {
    expect(isRowDirty({ a: 'x', b: 'y' }, { a: 'x' })).toBe(false)
    expect(isRowDirty({ a: 'x', b: 'y' }, { a: 'z' })).toBe(true)
  })
})

describe('mergeDraft', () => {
  it('overlays the staged edits onto the baseline', () => {
    expect(mergeDraft({ name: 'Pro', tier: '1' }, { tier: '2' })).toEqual({ name: 'Pro', tier: '2' })
  })

  it('returns a copy of the baseline when there are no edits', () => {
    const base = { name: 'Pro' }
    const merged = mergeDraft(base, undefined)
    expect(merged).toEqual(base)
    expect(merged).not.toBe(base)
  })

  it('mutates neither input', () => {
    const base = { name: 'Pro' }
    const edits = { name: 'Pro Plus' }
    mergeDraft(base, edits)
    expect(base).toEqual({ name: 'Pro' })
    expect(edits).toEqual({ name: 'Pro Plus' })
  })
})
