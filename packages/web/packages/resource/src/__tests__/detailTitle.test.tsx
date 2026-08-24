/**
 * `useDetailTitle` — a pane naming what it is showing, in the detail header.
 *
 * The publisher/host split is the point: a feature pane cannot reach the stack that
 * renders it, so it PUBLISHES the title the same way it publishes its levels and its
 * busy state. This asserts: the round trip through the standalone host; withdrawal when
 * a pane explicitly publishes `null` (a rerender, same pane, still mounted); withdrawal
 * on a REAL unmount (the pane's component leaves the tree entirely — this is the effect
 * CLEANUP path, distinct from the null-publish rerender above, and the two do not
 * exercise the same code); that the LAST of two simultaneous publishers wins, per
 * `host-stack.tsx`'s documented tie-break; and that a pane under NO host is simply quiet
 * rather than broken.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { StandaloneRailHost } from '../standalone-rail-host'
import { useDetailTitle, useStackLevel } from '../rail-host'

function Pane({ title }: { title: string | null }) {
  useStackLevel({
    id: 'docs',
    title: 'Documents',
    items: [{ id: 'a', label: 'A paper' }],
    selectedId: 'a',
    onSelect: () => {},
    onClear: () => {},
  })
  useDetailTitle(title)
  return <div>pane</div>
}

// A second, independently-keyed pane for the "two simultaneous publishers" case — a distinct
// `levelId` so both can register as rail levels at once without colliding.
function Pane2({ levelId, title }: { levelId: string; title: string }) {
  useStackLevel({
    id: levelId,
    title: levelId,
    items: [{ id: 'a', label: 'A paper' }],
    selectedId: 'a',
    onSelect: () => {},
    onClear: () => {},
  })
  useDetailTitle(title)
  return <div>{levelId}</div>
}

// The rail LEVEL and the detail-title PUBLISH are split into two independently-mountable
// components — unlike `Pane` above, which does both together. Unmounting `Pane` wholesale would
// also un-register its rail level, and `HierarchicalDetailView` stops rendering a detail title
// at all once no level is selected — so a title disappearing on that unmount is ambiguous: it
// proves nothing about `useDetailTitle`'s own effect cleanup specifically. Keeping `Level`
// mounted throughout isolates the one thing under test.
function Level() {
  useStackLevel({
    id: 'docs',
    title: 'Documents',
    items: [{ id: 'a', label: 'A paper' }],
    selectedId: 'a',
    onSelect: () => {},
    onClear: () => {},
  })
  return null
}

function TitlePublisher({ title }: { title: string }) {
  useDetailTitle(title)
  return <div>publisher</div>
}

function Wrapper({ show, title }: { show: boolean; title: string }) {
  return (
    <StandaloneRailHost>
      <Level />
      {show && <TitlePublisher title={title} />}
    </StandaloneRailHost>
  )
}

afterEach(cleanup)

describe('useDetailTitle', () => {
  it('puts the published title in the host’s detail header', async () => {
    render(
      <StandaloneRailHost>
        <Pane title="Intelligence at the Edges" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Intelligence at the Edges')).toBeInTheDocument()
  })

  it('withdraws it when the pane publishes null (same pane, stays mounted)', async () => {
    const { rerender } = render(
      <StandaloneRailHost>
        <Pane title="Intelligence at the Edges" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Intelligence at the Edges')).toBeInTheDocument()
    rerender(
      <StandaloneRailHost>
        <Pane title={null} />
      </StandaloneRailHost>,
    )
    expect(screen.queryByText('Intelligence at the Edges')).toBeNull()
  })

  it('withdraws it when the pane actually UNMOUNTS — the effect cleanup path', async () => {
    // Distinct from the null-publish case above: here the pane's component leaves the tree
    // entirely (rail level popped, route change), so only the effect's own cleanup —
    // `return () => setDetailTitle(id, null)` — can withdraw the title. A rerender that keeps
    // the same pane mounted and merely passes `title={null}` never touches that cleanup at
    // all, which is why that test alone could not catch it deleted.
    const { rerender } = render(<Wrapper show title="Intelligence at the Edges" />)
    expect(await screen.findByText('Intelligence at the Edges')).toBeInTheDocument()
    rerender(<Wrapper show={false} title="Intelligence at the Edges" />)
    expect(screen.queryByText('Intelligence at the Edges')).toBeNull()
  })

  it('the LAST of two simultaneous publishers wins, per the documented tie-break', async () => {
    // `host-stack.tsx` keys the title map by publisher id specifically so two panes cannot
    // cancel each other's title on unmount, and documents "the LAST to register wins" as the
    // rule while two are up at once. Nothing asserted that rule directly.
    render(
      <StandaloneRailHost>
        <Pane2 levelId="docs-a" title="First Pane" />
        <Pane2 levelId="docs-b" title="Second Pane" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Second Pane')).toBeInTheDocument()
    expect(screen.queryByText('First Pane')).toBeNull()
  })

  it('keeps the header on the frontier pane when a BACKGROUND pane re-titles', async () => {
    // The tie-break above is read off the title Map's INSERTION order, and a Map re-appends a
    // key that was deleted and re-set. So a publish effect that ran its own cleanup on every
    // title CHANGE would delete-and-re-append the background pane's key on each keystroke of
    // an edited title — and `at(-1)` would hand the header to the pane that is NOT on screen.
    // Only an in-place update keeps B in front, which is what `Map.set` on a live key does.
    const { rerender } = render(
      <StandaloneRailHost>
        <Pane2 levelId="docs-a" title="First Pane" />
        <Pane2 levelId="docs-b" title="Second Pane" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Second Pane')).toBeInTheDocument()

    rerender(
      <StandaloneRailHost>
        <Pane2 levelId="docs-a" title="First Pane v2" />
        <Pane2 levelId="docs-b" title="Second Pane" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Second Pane')).toBeInTheDocument()
    expect(screen.queryByText('First Pane v2')).toBeNull()
  })

  it('is a no-op with no host — the hook must not require one', () => {
    expect(() => render(<Pane title="Orphan" />)).not.toThrow()
  })
})
