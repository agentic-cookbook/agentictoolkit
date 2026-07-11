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
import { useState } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
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
 *  the pure-intent call (select/clear) rather than a re-render it would have to drive itself.
 *
 *  The frame keys its surface state (auto-hide, pins, the open hover branch) by the ROOT level's id,
 *  and that state deliberately outlives a mount — it has to, because selecting a row remounts the
 *  page subtree. So each test gets its OWN root id: two tests are two surfaces, not one surface
 *  visited twice, and neither inherits a branch the other left open. A test that means to model a
 *  remount passes the same `surface` twice (see the remount test). */
let surfaceSeq = 0
function levelsFor(
  sel: {
    region?: string | null
    eco?: string | null
    topic?: string | null
    onSelect?: Record<string, (id: string) => void>
    onClear?: Record<string, () => void>
  },
  surface = `s${++surfaceSeq}`,
): TopicLevel[] {
  const mk = (
    key: string,
    title: string,
    items: { id: string; label: string }[],
    selectedId: string | null,
  ): TopicLevel => ({
    id: `${surface}-${key}`,
    title,
    items,
    selectedId,
    onSelect: sel.onSelect?.[key] ?? (() => {}),
    onClear: sel.onClear?.[key] ?? (() => {}),
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

  it('stays open when a row inside it is selected — only leaving collapses it', () => {
    const selectEco = vi.fn()
    render(
      <HierarchicalTopicDetail
        levels={levelsFor({
          region: 'us',
          eco: 'core',
          topic: 'apps',
          onSelect: { ecosystems: selectEco },
        })}
      >
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))

    // Pick a row in a revealed list. The pointer is still inside the branch, so it must stay open —
    // collapsing under the cursor yanks the rows away mid-gesture, and you could never pick a parent
    // and then go on to pick its child, which is what the branch is open for.
    fireEvent.click(screen.getByRole('button', { name: /Temporal/ }))
    expect(selectEco).toHaveBeenCalledWith('temporal')
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')

    // It closes on the pointer leaving the branch, and only then.
    leave(col(1), screen.getByText('detail'))
    expect(boxWidth(0)).toBe('40px')
  })

  it('survives the REMOUNT a selection causes — the pointer never left, so the branch stays open', () => {
    // Selecting a row in the stack is a route change, and a route change remounts the page subtree.
    // The branch used to live in the stack's own state, so the user's click destroyed it: the lists
    // slammed shut under a pointer that was still sitting in them — and since the pointer hadn't
    // moved, no enter event would ever reopen them. Same surface (same root id) = same open branch.
    const { unmount } = render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' }, 'ws')}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))
    expect(boxWidth(0)).toBe('240px')

    unmount()
    render(
      // The re-rendered surface after the click: a different selection, the SAME surface.
      <HierarchicalTopicDetail levels={levelsFor({ region: 'eu', eco: 'core', topic: 'apps' }, 'ws')}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')

    // And it still closes on the one thing that should close it: the pointer leaving.
    leave(col(1), screen.getByText('detail'))
    expect(boxWidth(0)).toBe('40px')
  })

  it('closes a branch left open by a departed surface as soon as the pointer shows up elsewhere', () => {
    // The branch outliving its mount is the point above — but it must not outlive the POINTER. Leave
    // the surface with the pointer resting in an open branch and come back with the mouse somewhere
    // else, and no column can fire the leave that closes it; the document catches that.
    const { unmount } = render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' }, 'gone')}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))
    unmount()

    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' }, 'gone')}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(boxWidth(0)).toBe('240px') // still open — nothing has told it otherwise yet

    // The pointer turns up outside the stack entirely: proof it is not in the branch.
    fireEvent.pointerOver(document.body, { relatedTarget: null })
    expect(boxWidth(0)).toBe('40px')
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

  it('keeps the selection connectors above the revealed branch', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))

    // The branch lifts over the detail; the connector overlay must lift with it. When it didn't, the
    // revealed lists painted over the gold chain and the selection you were following disappeared the
    // moment you opened the branch.
    const overlay = document.querySelector('[data-htd-connectors]')
    if (!(overlay instanceof SVGElement)) throw new Error('no connector overlay')
    const overlayZ = Number(overlay.style.zIndex)
    const columnZ = [0, 1, 2].map((i) => Number(col(i).style.zIndex))
    expect(overlayZ).toBeGreaterThan(Math.max(...columnZ))
  })

  it('gives the open branch an edge on BOTH sides — leading and trailing', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(1)) // open the branch at the MIDDLE list: a peek sits behind it, the detail ahead of it

    // Leading edge: the peek's own border is clipped away with its rail, so this shadow is the only
    // boundary between the opened list and the icon strip behind it (it used to be dropped on reveal,
    // and the list visibly lost its border).
    expect(col(1).style.boxShadow).toContain('-10px')
    // Trailing edge: the last member shadows the detail the branch now floats over.
    expect(col(2).style.boxShadow).toContain('8px')
    // A member INSIDE the group needs neither — its neighbours abut it, separated by rail borders.
    expect(col(2).style.boxShadow).not.toContain('-10px')
  })

  it('walking LEFT into a shallower peek grows the branch — it does not collapse it', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // Open the branch at the middle list, then keep moving left into the peek beside it — the way you
    // walk back up the stack. The shallower list joins the cascade as its new root and pushes the
    // already-open lists to the right; collapsing the lot (which is what happened while the document
    // watcher overruled the enter) throws away everything the user just opened.
    enter(col(1))
    expect(boxWidth(1)).toBe('240px')
    expect(boxLeft(1)).toBe('40px')

    leave(col(1), col(0))
    enter(col(0))
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')
    expect(boxLeft(0)).toBe('0px')
    expect(boxLeft(1)).toBe('240px') // pushed right by the list that just joined
    expect(boxLeft(2)).toBe('480px')
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

describe('HierarchicalTopicDetail — a level’s default selection', () => {
  /** A live 2-level stack (Regions → Topics) whose Topics level names a default. Selection is real
   *  state here, not a spy, because the whole behaviour is about what happens across re-renders as
   *  the user drills in, clears, and comes back. */
  function Stack({ onSelectTopic }: { onSelectTopic: (id: string | null) => void }) {
    const [region, setRegion] = useState<string | null>(null)
    const [topic, setTopic] = useState<string | null>(null)
    const set = (t: string | null) => {
      setTopic(t)
      onSelectTopic(t)
    }
    const levels: TopicLevel[] = [
      {
        id: 'regions',
        title: 'Regions',
        items: REGIONS,
        selectedId: region,
        onSelect: (id) => {
          setRegion(id)
          set(null)
        },
        onClear: () => {
          setRegion(null)
          set(null)
        },
      },
      {
        id: 'topics',
        title: 'Topics',
        items: TOPICS,
        selectedId: topic,
        defaultSelectedId: 'users',
        onSelect: (id) => set(id),
        onClear: () => set(null),
      },
    ]
    return (
      <HierarchicalTopicDetail levels={levels}>
        <p>detail</p>
      </HierarchicalTopicDetail>
    )
  }
  const row = (name: RegExp) => screen.getByRole('button', { name })

  it('selects the default the moment the list appears, and not before', () => {
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)
    // Nothing is chosen for the user until the list that names the default actually appears.
    expect(onSelectTopic).not.toHaveBeenCalled()

    fireEvent.click(row(/us-west-1/))
    expect(onSelectTopic).toHaveBeenLastCalledWith('users')
    expect(row(/Users/)).toHaveAttribute('aria-current', 'true')
  })

  it('does not fight a manual deselect — the default arms once per visit', () => {
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)
    fireEvent.click(row(/us-west-1/))

    // Re-click the auto-selected row to clear it. A default that re-fires here makes the row
    // impossible to deselect — the default may choose FOR the user, never argue WITH them.
    fireEvent.click(row(/Users/))
    expect(onSelectTopic).toHaveBeenLastCalledWith(null)
    expect(row(/Users/)).not.toHaveAttribute('aria-current', 'true')
  })

  it('re-applies the default on the next visit to the parent topic', () => {
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)
    fireEvent.click(row(/us-west-1/))
    fireEvent.click(row(/Users/)) // clear it
    fireEvent.click(row(/us-west-1/)) // leave the region (re-click deselects) — the list goes away
    expect(onSelectTopic).toHaveBeenLastCalledWith(null)

    fireEvent.click(row(/eu-central-1/)) // come back in: the list re-appears, so the default re-arms
    expect(onSelectTopic).toHaveBeenLastCalledWith('users')
    expect(row(/Users/)).toHaveAttribute('aria-current', 'true')
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

  it('slides the pushed pane in from the right — even though the selection REMOUNTED the stack', async () => {
    // The panes always carried a transform transition, and it never played in the app: selecting a row
    // is a route change, the subtree remounts, and a pane that mounts already at its final transform
    // has nothing to animate FROM. The stack remembers the pane it was last painted at (per surface),
    // so the new pane still starts off-screen and then travels.
    const { unmount } = render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({ region: 'us' }, 'nav')}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(col(1).style.transform).toBe('translateX(0)') // the ecosystems list is the top pane

    unmount()
    render(
      // The user picked an ecosystem: same surface, one pane deeper.
      <HierarchicalTopicDetail
        layoutMode="narrow"
        levels={levelsFor({ region: 'us', eco: 'core' }, 'nav')}
      >
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // First paint of the remounted stack: still showing the pane it came from, with the incoming one
    // off the right edge — the frame the transition needs.
    expect(col(1).style.transform).toBe('translateX(0)')
    expect(col(2).style.transform).toBe('translateX(100%)')

    // Next frame it travels: the new pane to centre, its parent parallaxing out behind it.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    })
    expect(col(2).style.transform).toBe('translateX(0)')
    expect(col(1).style.transform).toBe('translateX(-30%)')
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
