/**
 * HierarchicalTopicDetail — the behaviours that are layout/interaction logic:
 *
 *  - the WHOLE-BRANCH hover reveal: hovering a covered list opens that list AND its children as one
 *    cascade, and it stays open while the pointer walks between them;
 *  - the SHRINK sequence: a list slid onto its parent as the container narrows, then off the left
 *    edge when even the peeks won't fit;
 *  - the NARROW layout: one full-width pane at a time, pushed on select and popped by Back.
 *
 * Everything that turns on "is this list covered" needs a container width, because width pressure is
 * the only thing that covers a list — see `installResizeHarness` for the harness that supplies one
 * and for the arithmetic behind the named widths. Enter/leave are dispatched as
 * `pointerover`/`pointerout` with a `relatedTarget`, because that is what React's synthetic
 * onPointerEnter/onPointerLeave are built from (a raw `pointerenter` doesn't bubble to React's root
 * listener).
 */
import { useState } from 'react'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  HierarchicalTopicDetail,
  type TopicLevel,
  type TopicSelectOptions,
} from '../blocks/hierarchical-topic-detail'

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

/** The WIDE stack's detail pane. Its presence IS the mode: the wide stack gives the detail its own
 *  section, the narrow one makes it the last pane in the `data-htd-col` sequence instead. */
const detail = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector('[data-htd-detail]')
  if (!(el instanceof HTMLElement)) throw new Error('no detail pane')
  return el
}
const isNarrow = (container: HTMLElement) => container.querySelector('[data-htd-detail]') === null

// React derives onPointerEnter/onPointerLeave from pointerover/pointerout + relatedTarget.
const enter = (el: HTMLElement, from: Element | null = document.body) =>
  fireEvent.pointerOver(el, { relatedTarget: from })
const leave = (el: HTMLElement, to: Element | null) =>
  fireEvent.pointerOut(el, { relatedTarget: to })

/** The RAIL row for a label. A frontier level used to be able to repeat those same labels into the
 *  pane as overview CARDS (buttons too), which made a bare getByRole ambiguous; that opt-in is gone,
 *  but the disambiguation stays — the rail row is the one carrying `data-htd-row`. */
const railRow = (name: RegExp): HTMLElement => {
  const rows = screen.getAllByRole('button', { name }).filter((b) => b.hasAttribute('data-htd-row'))
  if (rows.length !== 1) throw new Error(`expected exactly one rail row for ${name}, got ${rows.length}`)
  return rows[0]!
}

/** Swap in a ResizeObserver whose callbacks the test fires by hand, plus a settable `clientWidth`.
 *  Those two ARE the component's entire notion of how wide it is and of having just changed size,
 *  and jsdom supplies neither: it reports every element at width 0 and never runs an observer, so a
 *  stack rendered raw believes it has no room at all — and since there is no auto-hide mode any
 *  more, WIDTH PRESSURE is the only thing that covers a list. A test about a covered list therefore
 *  has to state its container width. Firing the callbacks by hand is also exactly what a window drag
 *  delivers, so the same harness drives the live-resize block at the bottom of this file.
 *
 *  The ladder those widths are read off (the fit math in `CoveredStack`): a list is 240px disclosed
 *  and 32px covered; once every level is selected the detail reserves `minDetailWidth` = 36rem =
 *  576px, and while the deepest list is an unselected frontier it reserves nothing (its pane is only
 *  a landing, so the list must stay pickable). Lists are covered leftmost-first until
 *  `Σ lists + detail ≤ container`, then slid off the LEFT EDGE if even all-peeks won't fit. */
function installResizeHarness(initial: number) {
  let width = initial
  const observers: (() => void)[] = []
  const realRO = globalThis.ResizeObserver
  const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  globalThis.ResizeObserver = class {
    constructor(private cb: () => void) {}
    observe() {
      observers.push(this.cb)
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  return {
    /** Move the container. Before a render this just sets the width the first measurement reads;
     *  after one it is a live resize, i.e. one frame of a window drag. */
    resizeTo(next: number) {
      width = next
      act(() => {
        observers.forEach((cb) => cb())
      })
    },
    restore() {
      globalThis.ResizeObserver = realRO
      if (realWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', realWidth)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
    },
  }
}

/** Install the harness for every test in the enclosing describe, and hand back a `resizeTo` the test
 *  can use before its render (to pick a starting width) or after one (to drag the window). */
function containerWidth(initial: number) {
  let harness: ReturnType<typeof installResizeHarness>
  beforeEach(() => {
    harness = installResizeHarness(initial)
  })
  afterEach(() => harness.restore())
  return (px: number) => harness.resizeTo(px)
}

// Widths off the ladder above. THREE selected levels: Σ lists + 576 is 1296 / 1088 / 880 / 672 as
// 0…3 of them are covered, so these land 0, 2 and 3-covered-plus-one-off-screen respectively.
const W3_NONE_COVERED = 1400
const W3_TWO_COVERED = 1000
const W3_ONE_OFF_SCREEN = 640
// A stack whose deepest list is the unselected FRONTIER claims no detail minimum at all (that pane
// is only a landing), so its ladder is just the rails: for THREE lists, 720 / 512 / 304. At 700 that
// covers exactly one — and the SAME width covers all three the moment a click completes the path and
// the detail claims its 576 (the selected ladder's third rung, 880, is still over 700). One width,
// both sides of the click. It stays above the 608px wide floor, under which there is no covered stack
// left to talk about because the whole layout is a navigation controller.
const W3_FRONTIER_ONE_COVERED = 700
// TWO levels, both selected — so the detail does claim its 576: 1056 / 848 / 640.
const W2_PARENT_COVERED = 900

describe('HierarchicalTopicDetail — whole-branch hover reveal', () => {
  containerWidth(W3_TWO_COVERED)

  it('opens the hovered list AND its children, chained side by side', () => {
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    // Too narrow to hold three 240px lists beside a 576px detail, so the two parents are peeks.
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

describe('HierarchicalTopicDetail — the click that pushes a choosing frontier', () => {
  const resizeTo = containerWidth(W3_FRONTIER_ONE_COVERED)

  it('covers the parent of a choosing frontier on a deep link (no pointer, no reveal)', () => {
    // Arriving BY URL two levels deep, with the third list still unselected, at a width with room
    // for two of the three lists: the outermost parent is a peek. No click happened here, so there
    // is no pointer for a reveal to serve — this is the plain covered layout.
    render(
      <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(boxWidth(0)).toBe('32px')
    expect(boxWidth(1)).toBe('240px')
    expect(boxLeft(1)).toBe('32px')
    expect(boxWidth(2)).toBe('240px') // the frontier is never the one covered
  })

  it('a click that covers the list it landed in roots the reveal: that list floats over the detail until the pointer leaves', () => {
    // Choosing in the frontier COMPLETES the path, and a complete path is what makes the detail
    // claim its 576px minimum — which at this width squeezes all three lists into peeks, the one the
    // click landed in included, with the pointer still inside it. That is the exact state
    // pointer-enter names, but the pointer never moved, so no enter will ever fire. The select roots
    // the branch itself: the clicked list stays open where it is, floating over the detail, and the
    // detail is pushed right to clear it.
    function Stack() {
      const [topic, setTopic] = useState<string | null>(null)
      return (
        <HierarchicalTopicDetail
          levels={levelsFor(
            { region: 'us', eco: 'core', topic, onSelect: { topics: setTopic } },
            'push',
          )}
        >
          <p>detail</p>
        </HierarchicalTopicDetail>
      )
    }
    const { container } = render(<Stack />)
    // A frontier reserves no detail width, so two of the three lists are still disclosed.
    expect(boxWidth(1)).toBe('240px')
    expect(boxWidth(2)).toBe('240px')

    fireEvent.click(railRow(/Applications/))
    expect(boxWidth(0)).toBe('32px') // the detail's 576 lands: every list is covered now
    expect(boxWidth(1)).toBe('32px')
    expect(boxWidth(2)).toBe('240px') // covered in LAYOUT, held open by the reveal
    expect(boxLeft(2)).toBe('64px') // in place, behind the two peeks — it did not travel
    expect(detail(container).style.left).toBe('304px') // pushed clear of the floating card

    // The pointer leaving the branch is what settles the stack into its covered layout.
    leave(col(2), screen.getByText('detail'))
    expect(boxWidth(2)).toBe('32px')
    expect(detail(container).style.left).toBe('96px')
  })

  it('a click that covers nothing roots nothing — a stack at rest casts no floating card', () => {
    // The same completing click, but with room to spare: it leaves the clicked list disclosed, so the
    // blind root the select plants is dropped as meaningless — same geometry as rest, and no trailing
    // card shadow over the detail (only the resting layered-stack shadow from its covered parent).
    //
    // Wider than the block's default: completing the path is what makes the detail claim its 576px
    // minimum, and this needs room for exactly one of the two lists once it does.
    resizeTo(W2_PARENT_COVERED)
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
  function Stack({
    onSelectTopic,
    region: region0 = null,
    topic: topic0 = null,
  }: {
    onSelectTopic: (id: string | null, opts?: TopicSelectOptions) => void
    /** Seed the stack mid-drill, i.e. the state a DEEP LINK hands it on first render. */
    region?: string | null
    topic?: string | null
  }) {
    const [region, setRegion] = useState<string | null>(region0)
    const [topic, setTopic] = useState<string | null>(topic0)
    // `opts` is recorded alongside the id: for a level that ROUTES, whether the stack asked to
    // replace or to push is part of the call, so the tests below pin it rather than dropping it.
    const set = (t: string | null, opts?: TopicSelectOptions) => {
      setTopic(t)
      onSelectTopic(t, opts)
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
        onSelect: (id, opts) => set(id, opts),
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
    expect(onSelectTopic).toHaveBeenLastCalledWith('users', { replace: true })
    expect(row(/Users/)).toHaveAttribute('aria-current', 'true')
  })

  it('asks to REPLACE when it chose, and not when the user did', () => {
    // The whole difference between the two, and the reason `opts` exists: the state a default
    // supersedes is one the user never asked for and never sees, so it must not become a Back
    // stop — landing on it would re-apply the default and bounce them straight forward again.
    // A clicked row is the opposite: the user asked for it, so it earns its own history entry.
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)

    fireEvent.click(row(/us-west-1/)) // the list appears → the default fires for the user
    expect(onSelectTopic).toHaveBeenLastCalledWith('users', { replace: true })

    fireEvent.click(row(/Applications/)) // the user picks a different topic
    expect(onSelectTopic).toHaveBeenLastCalledWith('apps', undefined)
  })

  it('does not fight a manual deselect — the default arms once per visit', () => {
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)
    fireEvent.click(row(/us-west-1/))

    // Re-click the auto-selected row to clear it. A default that re-fires here makes the row
    // impossible to deselect — the default may choose FOR the user, never argue WITH them.
    fireEvent.click(row(/Users/))
    expect(onSelectTopic).toHaveBeenLastCalledWith(null, undefined)
    expect(row(/Users/)).not.toHaveAttribute('aria-current', 'true')
  })

  it('does not fight a clear on a list that arrived ALREADY selected (a deep link)', () => {
    // The same rule as above, reached the other way: the list appears with the selection already
    // made (someone opened `…/topics/users` directly), so the default never fires and — before
    // this was fixed — never recorded that its visit was spent. Clearing the row then looked
    // like a fresh appearance with nothing chosen, so the default re-applied and the row could
    // not be deselected at all: a click that visibly did nothing.
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} region="us" topic="users" />)
    expect(onSelectTopic).not.toHaveBeenCalled() // nothing to choose — it is already chosen

    fireEvent.click(row(/Users/)) // re-click the selected row to clear it
    expect(onSelectTopic).toHaveBeenLastCalledWith(null, undefined)
    expect(row(/Users/)).not.toHaveAttribute('aria-current', 'true')
  })

  it('re-applies the default on the next visit to the parent topic', () => {
    const onSelectTopic = vi.fn()
    render(<Stack onSelectTopic={onSelectTopic} />)
    fireEvent.click(row(/us-west-1/))
    fireEvent.click(row(/Users/)) // clear it
    fireEvent.click(row(/us-west-1/)) // leave the region (re-click deselects) — the list goes away
    expect(onSelectTopic).toHaveBeenLastCalledWith(null, undefined)

    fireEvent.click(row(/eu-central-1/)) // come back in: the list re-appears, so the default re-arms
    expect(onSelectTopic).toHaveBeenLastCalledWith('users', { replace: true })
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

  it('has no cover toggles — a pane is the whole view, so there is nothing to cover', () => {
    render(
      <HierarchicalTopicDetail layoutMode="narrow" levels={levelsFor({ region: 'us' })}>
        <p>detail</p>
      </HierarchicalTopicDetail>,
    )
    expect(screen.queryByRole('button', { name: /cover/i })).not.toBeInTheDocument()
  })

  it('is what `auto` lands on below the wide floor, whatever is selected', () => {
    // The wide layout is worth keeping only while the detail can hold its 576px minimum beside one
    // 32px strip; under 608 there is nothing left to trade and one full-width pane at a time is the
    // better view. The floor does NOT move with the selection: an unselected frontier claims no
    // detail minimum inside the FIT MATH (so the list you are choosing from is never squeezed), and
    // reading that as a lower NARROW floor used to leave a 240px list beside a detail sliver a few
    // dozen pixels wide — two panes, neither usable. A selection-independent floor also means the
    // mode cannot flip under the click that changes the selection.
    //
    // Read off STRUCTURE, not the panes' transforms: which stack rendered is settled on the first
    // frame, while the narrow panes take an animation frame to slide to their resting offsets.
    const modeAt = (px: number, levels: TopicLevel[]) => {
      const harness = installResizeHarness(px)
      try {
        const { container, unmount } = render(
          <HierarchicalTopicDetail levels={levels}>
            <p>detail</p>
          </HierarchicalTopicDetail>,
        )
        const narrow = isNarrow(container)
        unmount()
        return narrow
      } finally {
        harness.restore()
      }
    }
    // Frontier unselected (the case whose floor used to be a bare 240px rail) and every level
    // selected, at the same two widths: one threshold, not two.
    expect(modeAt(600, levelsFor({ region: 'us' }))).toBe(true)
    expect(modeAt(600, levelsFor({ region: 'us', eco: 'core', topic: 'apps' }))).toBe(true)
    expect(modeAt(620, levelsFor({ region: 'us' }))).toBe(false)
    expect(modeAt(620, levelsFor({ region: 'us', eco: 'core', topic: 'apps' }))).toBe(false)
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
  // pane belongs to the package. There are two modes and no third: the default nudge, and the same
  // nudge carrying a host `overviewHelp` blurb. Every one of these asserts that no ROW is duplicated
  // into the pane — that is the rule (docs/ui/fleet-ui-audit.md §1.5), and the card grid that used
  // to be the `overview: "cards"` opt-in is exactly what it forbids.
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

  it('overview: false is the only opt-out, and it yields the pane to the host — not to a landing', () => {
    const levels = levelsFor({ region: 'us' })
    levels[1] = { ...levels[1]!, overview: false, overviewHelp: 'Pick an ecosystem.' }
    const { container } = render(
      <HierarchicalTopicDetail levels={levels}>
        <p>landing</p>
      </HierarchicalTopicDetail>,
    )
    expect(pane(container).querySelector('[data-htd-select-hint]')).toBeNull()
    // The blurb is ignored under the opt-out, and the rows still never appear in the pane: the
    // host's own children stand, which is the ONE case that exists (the inline create form).
    expect(within(pane(container)).queryByText('Pick an ecosystem.')).toBeNull()
    expect(within(pane(container)).queryByText('Core Platform')).toBeNull()
    expect(within(pane(container)).getByText('landing')).toBeInTheDocument()
  })
})

/** What the covered stack must get right while the WINDOW ITSELF is being dragged: where the detail's
 *  edges come from, and the fact that the shrink sequence is ANIMATED the whole way down. */
describe('HierarchicalTopicDetail — the covered stack during a live container resize', () => {
  const resizeTo = containerWidth(W3_NONE_COVERED)
  const threeLevels = () => (
    <HierarchicalTopicDetail levels={levelsFor({ region: 'us', eco: 'core', topic: 'apps' })}>
      <p>leaf</p>
    </HierarchicalTopicDetail>
  )

  it('pins the detail pane to the container’s right edge instead of sizing it from a measurement', () => {
    const { container } = render(threeLevels())
    // A JS width is a measurement from the PREVIOUS commit — during a drag the pane would trail the
    // edge it is supposed to sit on, and its width visibly wandered because of it. Anchoring both
    // edges makes the browser solve the width from the live container every frame instead.
    expect(detail(container).style.right).toBe('0px')
    expect(detail(container).style.width).toBe('')
    expect(detail(container).style.left).not.toBe('')
  })

  it('animates each step of the shrink — a list sliding onto its parent, then off the left edge', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(threeLevels())
      // Past the mount's in-place hold, so what follows is attributable to the resize alone.
      act(() => {
        vi.advanceTimersByTime(400)
      })
      expect(boxWidth(0)).toBe('240px') // room for all three

      // STEP ONE — narrow past the rung where three full lists fit: the two leftmost slide onto
      // their children as peeks. `width` and `left` both carry the transition, so the box wipes shut
      // and its neighbours travel into the room it gave up rather than snapping there.
      resizeTo(W3_TWO_COVERED)
      expect(boxWidth(0)).toBe('32px')
      expect(col(0).className).toMatch(/transition-\[left,width,box-shadow\]/)
      expect(col(2).className).toMatch(/transition-\[left,width,box-shadow\]/)
      expect(detail(container).className).toMatch(/transition-\[left\]/)

      // STEP TWO — narrow past the last rung, where even three peeks leave the detail under its
      // minimum: the leftmost list leaves the screen, and the stack shifts by exactly its width.
      // Same transitions, so it TRAVELS off the edge (the root is `overflow-hidden`, which clips it)
      // instead of vanishing.
      resizeTo(W3_ONE_OFF_SCREEN)
      expect(boxLeft(0)).toBe('-32px')
      expect(boxLeft(1)).toBe('0px')
      expect(col(0)).toHaveAttribute('aria-hidden', 'true') // gone from the AT tree with the screen
      expect(col(0).className).toMatch(/transition-\[left,width,box-shadow\]/)
    } finally {
      vi.useRealTimers()
    }
  })
})
