/**
 * `MasterDetailLeaf.footer` — the pane's FLOOR.
 *
 * A card that must stay in view while the editor above it scrolls cannot be the last
 * child of the scroller; it has to be a sibling of it. This asserts the structure that
 * makes that true (footer outside the scrolling region), and the rule that keeps it
 * honest: the footer belongs to the OPEN ROW, so with nothing selected there is a
 * select-hint and no footer at all.
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

function renderLeaf(opts: { editing: boolean; fill?: boolean }) {
  return render(
    <MasterDetailLeaf<{ body: string }>
      form={{ actions: ACTIONS, editing: opts.editing, draft: opts.editing ? { body: 'x' } : null }}
      emptyTitle="Select a document to edit."
      fill={opts.fill}
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

  it('scrolls the content region by default, and hands its height over when filling', () => {
    const { container, unmount } = renderLeaf({ editing: true })
    expect(
      (container.querySelector('[data-slot="detail-content"]') as HTMLElement).className,
    ).toContain('overflow-y-auto')
    unmount()
    const filled = renderLeaf({ editing: true, fill: true })
    expect(
      (filled.container.querySelector('[data-slot="detail-content"]') as HTMLElement).className,
    ).not.toContain('overflow-y-auto')
  })
})
