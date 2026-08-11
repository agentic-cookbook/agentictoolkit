import { describe, expect, it } from 'vitest'
import { deepestSelectedLevel } from '../blocks/stack-frontier'

const lvl = (selectedId: string | null) => ({ selectedId })

describe('deepestSelectedLevel', () => {
  it('is -1 for an empty stack', () => {
    expect(deepestSelectedLevel([])).toBe(-1)
  })

  it('is -1 when nothing is selected anywhere', () => {
    expect(deepestSelectedLevel([lvl(null), lvl(null)])).toBe(-1)
  })

  it('is the last level when every level is selected', () => {
    expect(deepestSelectedLevel([lvl('a'), lvl('b'), lvl('c')])).toBe(2)
  })

  it('is the level above the first unselected one', () => {
    expect(deepestSelectedLevel([lvl('a'), lvl('b'), lvl(null)])).toBe(1)
  })

  // THE GAP CASE. A deeper level can carry a selection while a shallower one does not (a level
  // that publishes a default, or one whose selection survived its parent being cleared). The
  // frontier stops at the FIRST hole — the stack below it is not reachable, so the leaf the user
  // can actually back out of is the level above the hole, not the deepest non-null one.
  it('stops at the FIRST unselected level, not the deepest selected one', () => {
    expect(deepestSelectedLevel([lvl('a'), lvl(null), lvl('c')])).toBe(0)
  })

  it('is -1 when the hole is the very first level', () => {
    expect(deepestSelectedLevel([lvl(null), lvl('b')])).toBe(-1)
  })
})
