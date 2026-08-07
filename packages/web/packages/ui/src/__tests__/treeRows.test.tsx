/** Unit tests for the nesting helpers. `flattenTree` is pure, and the cases below are the ones
 *  a screenshot can never show you: what a row with a MISSING parent does, and what a cycle
 *  does. Both must still render — a row that silently vanishes from a view claiming to show
 *  everything is the failure nobody reports, because there is nothing to see. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { flattenTree, ancestorIds, TreeRowLabel } from '../components/tree-rows'

interface Node {
  id: string
  parentId: string | null
  title: string
}

const n = (id: string, parentId: string | null, title = id): Node => ({ id, parentId, title })

const OPTS = { id: (r: Node) => r.id, parentId: (r: Node) => r.parentId }

/** The flattened shape as "id@depth", which is the whole contract in one readable string. */
function shape(rows: Node[], expanded?: ReadonlySet<string>): string[] {
  return flattenTree(rows, { ...OPTS, expanded }).map((t) => `${t.row.id}@${t.depth}`)
}

describe('flattenTree — ordering and depth', () => {
  const TREE = [n('a', null), n('a1', 'a'), n('a1x', 'a1'), n('b', null), n('b1', 'b')]

  it('walks depth-first, in input order within a parent', () => {
    expect(shape(TREE)).toEqual(['a@0', 'a1@1', 'a1x@2', 'b@0', 'b1@1'])
  })

  it('places a child under its parent however the input is ordered', () => {
    // The API hands back a flat list in position order; a child can precede its parent in it.
    const scrambled = [n('a1x', 'a1'), n('b', null), n('a', null), n('b1', 'b'), n('a1', 'a')]
    expect(shape(scrambled)).toEqual(['b@0', 'b1@1', 'a@0', 'a1@1', 'a1x@2'])
  })

  it('reports hasChildren so a leaf renders no toggle', () => {
    const flat = flattenTree(TREE, OPTS)
    expect(flat.filter((t) => t.hasChildren).map((t) => t.row.id)).toEqual(['a', 'a1', 'b'])
  })

  it('sorts siblings with `compare`, leaving the nesting intact', () => {
    const rows = [n('a', null), n('z', 'a'), n('m', 'a'), n('b', null)]
    const byId = (x: Node, y: Node) => x.id.localeCompare(y.id)
    expect(flattenTree(rows, { ...OPTS, compare: byId }).map((t) => t.row.id)).toEqual([
      'a',
      'm',
      'z',
      'b',
    ])
  })
})

describe('flattenTree — collapse', () => {
  const TREE = [n('a', null), n('a1', 'a'), n('a1x', 'a1'), n('b', null)]

  it('hides the subtree of a collapsed row', () => {
    expect(shape(TREE, new Set(['a1']))).toEqual(['a@0', 'b@0'])
  })

  it('an expanded parent with a collapsed child stops at the child', () => {
    expect(shape(TREE, new Set(['a']))).toEqual(['a@0', 'a1@1', 'b@0'])
  })

  it('omitting `expanded` shows the whole forest', () => {
    expect(shape(TREE)).toHaveLength(4)
  })
})

// The two integrity cases. Both used to be the same bug in every hand-rolled tree: descend from
// the roots, and anything not reachable from a root is never emitted.
describe('flattenTree — every row survives', () => {
  it('treats a row whose parent is absent as a root', () => {
    // 'x' points at a parent that was filtered out of this view.
    expect(shape([n('a', null), n('x', 'gone')])).toEqual(['a@0', 'x@0'])
  })

  it('treats a self-parented row as a root', () => {
    expect(shape([n('a', 'a')])).toEqual(['a@0'])
  })

  // A cycle has no root to descend from, so its members render as an arbitrary-but-stable
  // nesting rather than not at all. WHICH of the pair leads is not a contract; that both show up
  // is.
  it('emits the members of a cycle instead of dropping them', () => {
    const out = flattenTree([n('a', 'b'), n('b', 'a'), n('c', null)], OPTS)
    expect(out.map((t) => t.row.id).sort()).toEqual(['a', 'b', 'c'])
  })

  // The subtree of a COLLAPSED row is deliberately absent, and the cycle sweep above must not
  // "rescue" it back into the output as a root — that was the first version of this function.
  it('does not resurrect a collapsed subtree as roots', () => {
    const TREE = [n('a', null), n('a1', 'a'), n('a1x', 'a1'), n('b', null)]
    expect(shape(TREE, new Set())).toEqual(['a@0', 'b@0'])
  })

  it('is a permutation of the input for any parent graph', () => {
    const rows = [n('a', null), n('a1', 'a'), n('x', 'gone'), n('p', 'q'), n('q', 'p')]
    const out = flattenTree(rows, OPTS)
    expect(out).toHaveLength(rows.length)
    expect(new Set(out.map((t) => t.row.id))).toEqual(new Set(rows.map((r) => r.id)))
  })
})

describe('ancestorIds', () => {
  const TREE = [n('a', null), n('a1', 'a'), n('a1x', 'a1')]

  it('names every ancestor, so expanding them reveals the row', () => {
    expect(ancestorIds(TREE, 'a1x', OPTS)).toEqual(new Set(['a1', 'a']))
  })

  it('a root has none', () => {
    expect(ancestorIds(TREE, 'a', OPTS)).toEqual(new Set())
  })

  it('terminates on a cycle', () => {
    expect(ancestorIds([n('p', 'q'), n('q', 'p')], 'p', OPTS)).toEqual(new Set(['q', 'p']))
  })
})

describe('TreeRowLabel', () => {
  it('names the toggle after the row and reports its state', () => {
    const onToggle = vi.fn()
    render(
      <TreeRowLabel depth={1} hasChildren expanded={false} onToggle={onToggle} label="Ship it">
        <span>Ship it</span>
      </TreeRowLabel>,
    )
    const toggle = screen.getByRole('button', { name: 'Expand Ship it' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('says Collapse when open', () => {
    render(
      <TreeRowLabel depth={0} hasChildren expanded onToggle={vi.fn()} label="Ship it">
        <span>Ship it</span>
      </TreeRowLabel>,
    )
    expect(screen.getByRole('button', { name: 'Collapse Ship it' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  // A leaf keeps the toggle's WIDTH but not the control: titles line up in a column instead of
  // jogging left and right by a chevron depending on whether a row happens to have children.
  it('a leaf renders no toggle', () => {
    render(
      <TreeRowLabel depth={2} hasChildren={false} expanded={false} onToggle={vi.fn()} label="Leaf">
        <span>Leaf</span>
      </TreeRowLabel>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Leaf')).toBeInTheDocument()
  })
})
