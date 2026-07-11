/**
 * HierarchicalTopicDetail — the two behaviours that are pure layout/interaction logic (no measured
 * geometry, so jsdom can hold them honestly):
 *
 *  - the WHOLE-BRANCH hover reveal: hovering a covered list opens that list AND its children as one
 *    cascade, and it stays open while the pointer walks between them;
 *  - the NARROW layout: one full-width pane at a time, pushed on select and popped by Back.
 *
 * jsdom reports every element at width 0, so the covered stack's width-pressure layer is inert here
 * and `autoHideTopics` (the default) is what covers the parents — which is exactly the state the
 * reveal exists to serve. Enter/leave are dispatched as `pointerover`/`pointerout` with a
 * `relatedTarget`, because that is what React's synthetic onPointerEnter/onPointerLeave are built
 * from (a raw `pointerenter` doesn't bubble to React's root listener).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HierarchicalTopicDetail, type TopicLevel } from '../blocks/hierarchical-topic-detail'

const REGIONS = [
  { id: 'us', label: 'us-west-1' },
  { id: 'eu', label: 'eu-central-1' },
]
const ECOSYSTEMS = [
  { id: 'core', label: 'Core Platform' },
  { id: 'temporal', label: 'Temporal' },
]
const TOPICS = [
  { id: 'apps', label: 'Applications' },
  { id: 'users', label: 'Users' },
]

/** Three levels, with whichever selections the test wants. Handlers are spies so a test can assert
 *  the pure-intent call (select/clear) rather than a re-render it would have to drive itself. */
function levelsFor(sel: {
  region?: string | null
  eco?: string | null
  topic?: string | null
  onSelect?: Record<string, (id: string) => void>
  onClear?: Record<string, () => void>
}): TopicLevel[] {
  const mk = (
    id: string,
    title: string,
    items: { id: string; label: string }[],
    selectedId: string | null,
  ): TopicLevel => ({
    id,
    title,
    items,
    selectedId,
    onSelect: sel.onSelect?.[id] ?? (() => {}),
    onClear: sel.onClear?.[id] ?? (() => {}),
  })
  return [
    mk('regions', 'Regions', REGIONS, sel.region ?? null),
    mk('ecosystems', 'Ecosystems', ECOSYSTEMS, sel.eco ?? null),
    mk('topics', 'Topics', TOPICS, sel.topic ?? null),
  ]
}

const col = (i: number): HTMLElement => {
  const el = document.querySelector(`[data-htd-col="${i}"]`)
  if (!(el instanceof HTMLElement)) throw new Error(`no column ${i}`)
  return el
}
/** The rendered box width of a column — `40px` while it peeks, the full rail once revealed. */
const boxWidth = (i: number) => col(i).style.width
const boxLeft = (i: number) => col(i).style.left

// React derives onPointerEnter/onPointerLeave from pointerover/pointerout + relatedTarget.
const enter = (el: HTMLElement, from: Element | null = document.body) =>
  fireEvent.pointerOver(el, { relatedTarget: from })
const leave = (el: HTMLElement, to: Element | null) =>
  fireEvent.pointerOut(el, { relatedTarget: to })

describe('HierarchicalTopicDetail — whole-branch hover reveal', () => {
  it('opens the hovered list AND its children, chained side by side', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // Auto-hide (the default) covers both parents: each is a 40px peek.
    expect(boxWidth(0)).toBe('40px')
    expect(boxWidth(1)).toBe('40px')

    enter(col(0))

    // The hovered list AND every list below it open to full width, laid out end to end from where
    // the hovered list already sat — the branch, not just the one list.
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')
    expect(boxLeft(0)).toBe('0px')
    expect(boxLeft(1)).toBe('240px')
    expect(boxLeft(2)).toBe('480px')
  })

  it('stays open while the pointer moves from the hovered list into one of its children', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))
    expect(boxWidth(0)).toBe('240px')

    // Walking the cascade: leave the hovered list INTO its revealed child. The branch is the unit —
    // this must not collapse it (the old per-list reveal closed here).
    leave(col(0), col(1))
    enter(col(1))
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')
  })

  it('collapses back to the previous state when the pointer leaves the whole branch', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))
    expect(boxWidth(0)).toBe('240px')

    // Out of the branch entirely (into the detail pane, which is not a column).
    leave(col(1), screen.getByText('detail'))
    expect(boxWidth(0)).toBe('40px')
    expect(boxWidth(1)).toBe('40px')
    expect(boxLeft(1)).toBe('40px')
  })

  it('re-roots the branch when the pointer enters a different covered list', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(1)) // hover the SECOND list: it opens with its child, but list 0 stays a peek
    expect(boxWidth(0)).toBe('40px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')
    // The branch starts where the hovered list already sat (list 0 still peeks to its left).
    expect(boxLeft(1)).toBe('40px')
    expect(boxLeft(2)).toBe('280px')
  })
})

describe('HierarchicalTopicDetail — narrow (navigation-stack) layout', () => {
  it('shows the frontier list full-width, with every other pane inert', () => {
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({ region: 'us' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // Region chosen, ecosystem not → the ecosystems list is the top of the navigation stack.
    expect(col(1).style.transform).toBe('translateX(0)')
    expect(col(1)).not.toHaveAttribute('aria-hidden')
    // Its parent parallaxes behind it; the panes ahead of it wait off the right edge.
    expect(col(0).style.transform).toBe('translateX(-30%)')
    expect(col(0)).toHaveAttribute('aria-hidden', 'true')
    expect(col(2).style.transform).toBe('translateX(100%)')
    expect(col(2)).toHaveAttribute('aria-hidden', 'true')
    expect(col(3).style.transform).toBe('translateX(100%)') // the detail
  })

  it('pushes the detail once every level is selected', () => {
    render(
      <HierarchicalTopicDetail
        layoutMode="narrow"
        levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}
      >
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(col(3).style.transform).toBe('translateX(0)') // the detail is the top pane
    expect(col(2).style.transform).toBe('translateX(-30%)')
    expect(screen.getByText('detail')).toBeInTheDocument()
  })

  it('Back pops one pane — it clears the deepest SELECTED level', () => {
    const clearTopics = vi.fn()
    const clearEcos = vi.fn()
    render(
      <HierarchicalTopicDetail
        layoutMode="narrow"
        levels={levelsFor({
          region: 'us',
          eco: 'core',
          topic: 'apps',
          onClear: { topics: clearTopics, ecosystems: clearEcos },
        })}
      >
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // The detail is on top; its Back clears the topic (the deepest selection), landing on the topics
    // list. Every pane carries a Back except the root, so target the one in the visible pane.
    const backs = screen.getAllByRole('button', { name: 'Back' })
    fireEvent.click(backs[backs.length - 1]!)
    expect(clearTopics).toHaveBeenCalledTimes(1)
    expect(clearEcos).not.toHaveBeenCalled()
  })

  it('gives the root pane no Back (there is nowhere to pop to)', () => {
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({})}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(col(0).style.transform).toBe('translateX(0)') // the regions list is the whole view
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('has no cover toggles or auto-hide toggle — there is nothing to cover', () => {
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({ region: 'us' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(screen.queryByRole('button', { name: /cover/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Auto-hide/i })).not.toBeInTheDocument()
  })
})
