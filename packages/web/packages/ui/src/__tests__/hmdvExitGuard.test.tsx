/**
 * HierarchicalMenuDetail's unsaved-work gate: what the block does when an action that would
 * clear a level meets a dirty leaf editor.
 *
 * The exit is driven through the ROOT breadcrumb, because that crumb is the one affordance the
 * block owns in every layout (the covered stack has no Back button) and its handler is
 * `attemptExit(() => levels[0].onClear())` — a real exit whose completion is observable as a
 * call to that level's `onClear`.
 *
 * Two buttons, never three: the alert does not save — `PaneExitGuard` carries no `save()` at all.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HierarchicalMenuDetail } from '../blocks/hierarchical-menu-detail'

// The block keys module-scoped surface state (pins/hover) by the ROOT level's id and that state
// deliberately outlives a mount, so each test gets its own id rather than inheriting a neighbour's.
let surfaceSeq = 0

/** One level, one selected row, so the root crumb is rendered and clicking it is a real exit. */
function renderWithGuard(isDirty: boolean) {
  const onClear = vi.fn()
  const guard = { isDirty: () => isDirty }
  render(
    <HierarchicalMenuDetail
      rootLabel="Things"
      levels={[
        {
          id: `exit-things-${++surfaceSeq}`,
          title: 'Things',
          items: [{ id: 'a', label: 'Thing A' }],
          selectedId: 'a',
          onSelect: vi.fn(),
          onClear,
        },
      ]}
      exitGuard={guard}
    >
      <div>detail body</div>
    </HierarchicalMenuDetail>,
  )
  return { guard, onClear }
}

/** The root crumb — scoped to the breadcrumb, since the level's title reads the same. */
function clickRootCrumb(): void {
  const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
  fireEvent.click(within(trail).getByRole('button', { name: 'Things' }))
}

describe('HierarchicalMenuDetail — exit guard', () => {
  it('exits immediately when the guard is clean', () => {
    const { onClear } = renderWithGuard(false)
    clickRootCrumb()
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('raises a two-button alert when dirty, with no Save', () => {
    renderWithGuard(true)
    clickRootCrumb()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('holds the exit until the user answers', () => {
    const { onClear } = renderWithGuard(true)
    clickRootCrumb()
    expect(onClear).not.toHaveBeenCalled()
  })

  it('Discard runs the held exit', () => {
    const { onClear } = renderWithGuard(true)
    clickRootCrumb()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('Stay aborts the exit and keeps the editor', () => {
    const { onClear } = renderWithGuard(true)
    clickRootCrumb()
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onClear).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
