/**
 * `MasterDetailLeaf` — what belongs to the OPEN ROW, and what the pane keeps.
 *
 * A card that must stay in view while the editor above it scrolls cannot be the last
 * child of the scroller; it has to be a sibling of it. This asserts the structure that
 * makes that true (footer outside the scrolling region), and the rule that keeps it
 * honest: the footer AND the action bar belong to the OPEN ROW, so with nothing selected
 * there is a select-hint and neither of them.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MasterDetailLeaf } from '../master-detail/MasterDetailLeaf'

const ACTIONS = {
  onSave: () => {},
  onCancel: () => {},
  onDelete: () => {},
  saving: false,
  dirty: false,
} as never

function renderLeaf(opts: { editing: boolean }) {
  return render(
    <MasterDetailLeaf<{ body: string }>
      form={{ actions: ACTIONS, editing: opts.editing, draft: opts.editing ? { body: 'x' } : null }}
      emptyTitle="Select a document to edit."
      trailing={<button type="button">API</button>}
      footer={<div data-testid="publish">publish</div>}
      renderDetail={(d) => <div data-testid="editor">{d.body}</div>}
    />,
  )
}

afterEach(cleanup)

describe('MasterDetailLeaf footer', () => {
  it('renders the footer OUTSIDE the region the editor lives in', () => {
    const { container } = renderLeaf({ editing: true })
    const editor = screen.getByTestId('editor')
    const footer = screen.getByTestId('publish')
    const region = container.querySelector('[data-slot="detail-content"]') as HTMLElement
    expect(region).toContainElement(editor)
    expect(region).not.toContainElement(footer)
  })

  it('drops the footer when no row is open — it belongs to the open row', () => {
    renderLeaf({ editing: false })
    expect(screen.getByText('Select a document to edit.')).toBeInTheDocument()
    expect(screen.queryByTestId('publish')).toBeNull()
  })
})

describe('MasterDetailLeaf action bar', () => {
  it('shows the bar while a row is open', () => {
    renderLeaf({ editing: true })
    expect(screen.getByRole('toolbar', { name: 'Editing actions' })).toBeInTheDocument()
  })

  // The defect this locks out: a Delete / Cancel / Save bar, every control disabled, sitting
  // directly above "Select a … to edit". Every action it offers acts on a draft that does not
  // exist, and `trailing` is the OPEN ROW's affordance too — a row of dead controls advertises
  // actions and then refuses them, with nothing on screen explaining why. Seen on both the
  // research and the notebook surfaces, which is one bug in this one shared leaf.
  it('renders NO action bar when nothing is selected — and keeps the empty-state message', () => {
    renderLeaf({ editing: false })
    expect(screen.queryByRole('toolbar', { name: 'Editing actions' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'API' })).toBeNull()
    expect(screen.getByText('Select a document to edit.')).toBeInTheDocument()
  })
})

describe('MasterDetailLeaf content region', () => {
  // The region is the pane's ONE scroller, open or not. It used to clip instead whenever the
  // detail was a filling editor, which left a pane shorter than the editor's own minimum with
  // nowhere to overflow to: the editor's flex chain collapsed and its fields painted over each
  // other. A scroller is what makes the overflow reachable instead.
  it('always scrolls, so a detail taller than the pane stays reachable', () => {
    const { container } = renderLeaf({ editing: true })
    const region = container.querySelector('[data-slot="detail-content"]') as HTMLElement
    expect(region.className).toContain('overflow-y-auto')
    expect(region.className).not.toContain('overflow-hidden')
  })
})

/**
 * The short-pane contract. jsdom resolves no layout, so these assert the two classes that
 * ENCODE the decision rather than the pixels they produce — the pixels were measured in a
 * real browser (24px -> 168px at a 463px viewport, unchanged 249px at 723px) and are
 * recorded in the component's own comments. Both assertions fail if the change is reverted.
 */
describe('MasterDetailLeaf short-pane floor', () => {
  it('gives the editor region a floor so a rigid footer cannot starve it', () => {
    const { container } = renderLeaf({ editing: true })
    const region = container.querySelector('[data-slot="detail-content"]') as HTMLElement
    // Without a floor this box has `min-h-0` + `flex-1` and will give up ALL of its height to
    // the `shrink-0` footer: measured at a 463px viewport the footer held 145px while this
    // fell to 24px, a window too small to edit in.
    expect(region.className).toContain('min-h-56')
    expect(region.className).not.toContain('min-h-0')
  })

  it('lets the leaf itself scroll, so the floor has somewhere to overflow to', () => {
    const { container } = renderLeaf({ editing: true })
    const region = container.querySelector('[data-slot="detail-content"]') as HTMLElement
    const leaf = region.parentElement as HTMLElement
    // A floor with nowhere to overflow to is the collapse this component already fixed once
    // (boxes crushed, fields painted over each other). The floor and this overflow are one
    // change: neither is correct without the other.
    expect(leaf.className).toContain('overflow-y-auto')
  })
})
