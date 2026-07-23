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
import { act, render, screen, fireEvent, within } from '@testing-library/react'
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
/** The rendered box width of a column — `32px` while it peeks, the full rail once revealed. */
const boxWidth = (i: number) => col(i).style.width
const boxLeft = (i: number) => col(i).style.left

// React derives onPointerEnter/onPointerLeave from pointerover/pointerout + relatedTarget.
const enter = (el: HTMLElement, from: Element | null = document.body) =>
  fireEvent.pointerOver(el, { relatedTarget: from })
const leave = (el: HTMLElement, to: Element | null) =>
  fireEvent.pointerOut(el, { relatedTarget: to })

/** The RAIL row for a label. A frontier level opted into `overview: "cards"` renders the same
 *  labels as overview CARDS (role button too), so a bare getByRole can be ambiguous — the rail
 *  row is the one that carries `data-htd-row`. */
const railRow = (name: RegExp): HTMLElement => {
  const rows = screen.getAllByRole('button', { name }).filter((b) => b.hasAttribute('data-htd-row'))
  if (rows.length !== 1) throw new Error(`expected exactly one rail row for ${name}, got ${rows.length}`)
  return rows[0]!
}

describe('HierarchicalTopicDetail — whole-branch hover reveal', () => {
  it('opens the hovered list AND its children, chained side by side', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // Auto-hide (the default) covers both parents: each is a 32px peek.
    expect(boxWidth(0)).toBe('32px')
    expect(boxWidth(1)).toBe('32px')

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
    expect(boxWidth(0)).toBe('32px')
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
    expect(boxWidth(0)).toBe('32px')
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
    expect(boxWidth(0)).toBe('32px')
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
    expect(boxWidth(0)).toBe('32px')
    expect(boxWidth(1)).toBe('32px')
    expect(boxLeft(1)).toBe('32px')
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

  it('gives the click-rooted branch an edge on BOTH sides — leading and trailing', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // A CLICK roots the classic branch at the clicked list (a pointer ENTER opens everything, so
    // only the click-rooted group ever has a peek left standing behind it). Click a row in the
    // MIDDLE covered list: the branch opens at it, list 0 stays a peek behind it.
    fireEvent.click(railRow(/Temporal/))
    expect(boxWidth(0)).toBe('32px') // a click must never spring the user's collapsed parents open

    // Leading edge: the peek's own border is clipped away with its rail, so this shadow is the only
    // boundary between the opened list and the icon strip behind it (it used to be dropped on reveal,
    // and the list visibly lost its border).
    expect(col(1).style.boxShadow).toContain('-10px')
    // Trailing edge: the last member shadows the detail the branch now floats over.
    expect(col(2).style.boxShadow).toContain('8px')
    // A member INSIDE the group needs neither — its neighbours abut it, separated by rail borders.
    expect(col(2).style.boxShadow).not.toContain('-10px')
  })

  it('walking LEFT through the open cascade never collapses it', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // A pointer ENTER opens every on-screen list at once, so the shallower lists are already part
    // of the cascade. Walking left into one of them must keep the group exactly as it is —
    // collapsing it (which is what happened while the document watcher overruled the enter) throws
    // away everything the user just opened.
    enter(col(1))
    expect(boxWidth(1)).toBe('240px')

    leave(col(1), col(0))
    enter(col(0))
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')
    expect(boxLeft(0)).toBe('0px')
    expect(boxLeft(1)).toBe('240px')
    expect(boxLeft(2)).toBe('480px')
  })

  it('a pointer ENTER on any covered list opens EVERY on-screen list — parents included', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(1)) // hover the SECOND list: the whole stack opens, not just the branch below it
    // Walking the stack leftwards peek-by-peek is what this replaces: the parents open too, in one
    // cascade chained from the left edge.
    expect(boxWidth(0)).toBe('240px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')
    expect(boxLeft(0)).toBe('0px')
    expect(boxLeft(1)).toBe('240px')
    expect(boxLeft(2)).toBe('480px')
  })
})

describe('HierarchicalTopicDetail — auto-hide and the click that pushes a choosing frontier', () => {
  it('covers the parent of a choosing frontier on a deep link (no pointer, no reveal)', () => {
    // Arriving BY URL with a selection whose child list is still unselected: auto-hide covers the
    // parent as it covers any list above the frontier — no click happened here, so there is no
    // pointer for a reveal to serve.
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us' }).slice(0, 2)}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(boxWidth(0)).toBe('32px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxLeft(1)).toBe('32px')
  })

  it('a click that pushes a new choosing list roots the reveal: the new list floats over the detail until the pointer leaves', () => {
    // The click covers the list it landed in (auto-hide) with the pointer still inside it — the
    // exact state pointer-enter names, but the pointer never moved, so no enter will ever fire.
    // The select roots the branch itself: the clicked list stays open in place and the new
    // choosing list slides out OVER the detail (at 240px — its resting slot would be 40px).
    function Stack() {
      const [region, setRegion] = useState<string | null>(null)
      const levels: TopicLevel[] = [
        {
          id: 'push-regions',
          title: 'Regions',
          items: REGIONS,
          selectedId: region,
          onSelect: setRegion,
          onClear: () => setRegion(null),
        },
        {
          id: 'push-ecosystems',
          title: 'Ecosystems',
          items: ECOSYSTEMS,
          selectedId: null,
          onSelect: () => {},
          onClear: () => {},
        },
      ]
      return (
        <HierarchicalTopicDetail levels={levels}>
          <p>detail</p>
        </HierarchicalTopicDetail>
      )
    }
    render(<Stack />)
    expect(boxWidth(0)).toBe('240px') // the sole list, disclosed, waiting to be chosen from

    fireEvent.click(railRow(/us-west-1/))
    expect(boxWidth(0)).toBe('240px') // covered in LAYOUT, held open by the reveal
    expect(boxLeft(0)).toBe('0px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxLeft(1)).toBe('240px') // floating over the detail, not snugged into the 40px slot

    // The pointer leaving the branch is what settles the stack into its covered layout.
    leave(col(0), screen.getByText('detail'))
    expect(boxWidth(0)).toBe('32px')
    expect(boxLeft(1)).toBe('32px')
  })

  it('a click that completes the path roots nothing — a stack at rest casts no floating card', () => {
    // Selecting in the LAST level covers nothing at/below the clicked list, so the blind root the
    // select plants is dropped as meaningless: same geometry as rest, and no trailing card shadow
    // over the detail (only the resting layered-stack shadow from its covered parent).
    function Stack() {
      const [eco, setEco] = useState<string | null>(null)
      const levels: TopicLevel[] = [
        {
          id: 'complete-regions',
          title: 'Regions',
          items: REGIONS,
          selectedId: 'us',
          onSelect: () => {},
          onClear: () => {},
        },
        {
          id: 'complete-ecosystems',
          title: 'Ecosystems',
          items: ECOSYSTEMS,
          selectedId: eco,
          onSelect: setEco,
          onClear: () => setEco(null),
        },
      ]
      return (
        <HierarchicalTopicDetail levels={levels}>
          <p>detail</p>
        </HierarchicalTopicDetail>
      )
    }
    render(<Stack />)
    fireEvent.click(railRow(/Core Platform/))
    expect(boxWidth(0)).toBe('32px')
    expect(boxWidth(1)).toBe('240px')
    // The resting layered-stack shadow (its parent peeks under it) — but no floating trailing
    // edge over the detail, and no z-lift: the reveal machinery left the resting stack alone.
    expect(col(1).style.boxShadow).toContain('22px') // SHADOW_LEFT, the resting overlap
    expect(col(1).style.boxShadow).not.toContain('24px') // SHADOW_RIGHT, the floating card's edge
    expect(Number(col(1).style.zIndex)).toBeLessThan(50) // REVEAL_Z
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
  const row = railRow

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

  it('gives every selectable row a trailing disclosure chevron — the pane has no peeking sibling column left to hint that a tap pushes further', () => {
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({})}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    const row = screen.getByRole('button', { name: 'us-west-1' })
    expect(row.querySelector('.lucide-chevron-right')).toBeInTheDocument()
  })

  it('omits the chevron on a disabled row — it has nowhere to disclose', () => {
    const levels: TopicLevel[] = [
      {
        id: 'disabled-row-regions',
        title: 'Regions',
        items: [...REGIONS, { id: 'off', label: 'Disabled Region', disabled: true }],
        selectedId: null,
        onSelect: () => {},
        onClear: () => {},
      },
    ]
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levels}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(
      screen.getByRole('button', { name: 'Disabled Region' }).querySelector('.lucide-chevron-right'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'us-west-1' }).querySelector('.lucide-chevron-right'),
    ).toBeInTheDocument()
  })

  it('the WIDE covered stack does not show the narrow-only chevron — the connector line already shows what a selection leads to', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    enter(col(0))
    const row = within(col(1)).getByRole('button', { name: /Core Platform/ })
    expect(row.querySelector('.lucide-chevron-right')).not.toBeInTheDocument()
  })
})

describe('HierarchicalTopicDetail — the automatic frontier detail', () => {
  // With a region chosen and no ecosystem, the ecosystems list is the unselected frontier and the
  // pane belongs to the package. The three modes: default nudge / `overview: "cards"` / a host
  // `overviewHelp` blurb (which wins over both).
  const pane = (container: HTMLElement): HTMLElement => {
    const el = container.querySelector('section')
    if (!(el instanceof HTMLElement)) throw new Error('no detail pane')
    return el
  }

  it('defaults to the select-something nudge, named after the list — no row is duplicated into the pane', () => {
    const { container } = render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us' })}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(pane(container).querySelector('[data-htd-select-hint]')).not.toBeNull()
    // No itemNoun declared → the level's title is the subject.
    expect(
      within(pane(container)).getByText('Select an item from Ecosystems to view or edit it here.'),
    ).toBeInTheDocument()
    expect(within(pane(container)).queryByText('Core Platform')).toBeNull()
  })

  it('itemNoun + overviewHelp: "Select a(n) <noun>" over the bespoke what-and-why blurb', () => {
    const levels = levelsFor({ region: 'us' })
    levels[1] = {
      ...levels[1]!,
      itemNoun: 'ecosystem',
      overviewHelp: 'An ecosystem is one product platform. Pick the one to work in.',
    }
    const { container } = render(
      <HierarchicalTopicDetail levels={levels}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(within(pane(container)).getByText('Select an ecosystem')).toBeInTheDocument()
    expect(
      within(pane(container)).getByText('An ecosystem is one product platform. Pick the one to work in.'),
    ).toBeInTheDocument()
    expect(within(pane(container)).queryByText('Core Platform')).toBeNull()
  })

  it('an EMPTY list with overviewHelp shows the blurb alone — nothing to select yet', () => {
    const levels = levelsFor({ region: 'us' })
    levels[1] = {
      ...levels[1]!,
      items: [],
      itemNoun: 'ecosystem',
      overviewHelp: 'Ecosystems appear here once one is created.',
    }
    const { container } = render(
      <HierarchicalTopicDetail levels={levels}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(
      within(pane(container)).getByText('Ecosystems appear here once one is created.'),
    ).toBeInTheDocument()
    expect(within(pane(container)).queryByText(/^Select /)).toBeNull()
  })

  it('renders the card grid only for a level opted into overview: "cards"', () => {
    const levels = levelsFor({ region: 'us' })
    levels[1] = { ...levels[1]!, overview: 'cards' }
    const { container } = render(
      <HierarchicalTopicDetail levels={levels}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(pane(container).querySelector('[data-htd-select-hint]')).toBeNull()
    expect(within(pane(container)).getByText('Core Platform')).toBeInTheDocument()
  })

  it('the "cards" grid wins over overviewHelp while the list has rows to show as cards', () => {
    const levels = levelsFor({ region: 'us' })
    levels[1] = { ...levels[1]!, overview: 'cards', overviewHelp: 'Pick an ecosystem.' }
    const { container } = render(
      <HierarchicalTopicDetail levels={levels}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(within(pane(container)).getByText('Core Platform')).toBeInTheDocument()
    expect(pane(container).querySelector('[data-htd-select-hint]')).toBeNull()
    expect(within(pane(container)).queryByText('Pick an ecosystem.')).toBeNull()
  })
})
