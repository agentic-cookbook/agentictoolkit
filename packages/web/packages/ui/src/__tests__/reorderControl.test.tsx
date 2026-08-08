import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReorderControl } from '../components/reorder-control'

describe('ReorderControl', () => {
  it('wires each arrow to its own handler, labelled by subject', () => {
    const onMoveUp = vi.fn()
    const onMoveDown = vi.fn()
    render(
      <ReorderControl
        canMoveUp
        canMoveDown
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        subject="work item Ship it"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move up work item Ship it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move down work item Ship it' }))
    expect(onMoveUp).toHaveBeenCalledTimes(1)
    expect(onMoveDown).toHaveBeenCalledTimes(1)
  })

  it('disables the arrow at a boundary rather than removing it', () => {
    // Both buttons stay in the DOM on the first row. Their PRESENCE is what tells anyone the
    // list has an order at all, and a control that vanished would reflow the column and slide
    // the other arrow under a pointer already aimed at it.
    const onMoveUp = vi.fn()
    render(
      <ReorderControl
        canMoveUp={false}
        canMoveDown
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />,
    )
    const up = screen.getByRole('button', { name: 'Move up' })
    expect(up).toHaveProperty('disabled', true)
    fireEvent.click(up)
    expect(onMoveUp).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Move down' })).toHaveProperty('disabled', false)
  })

  it('busy ignores clicks but keeps both arrows focusable', () => {
    // aria-disabled, not disabled: a keyboard user who pressed ↑ must still be standing on it
    // when the request lands, or the move throws their place in the table away.
    const onMoveUp = vi.fn()
    render(
      <ReorderControl
        canMoveUp
        canMoveDown
        busy
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />,
    )
    const up = screen.getByRole('button', { name: 'Move up' })
    fireEvent.click(up)
    expect(onMoveUp).not.toHaveBeenCalled()
    expect(up).toHaveProperty('disabled', false)
    expect(up.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('group', { name: 'Reorder' }).getAttribute('aria-busy')).toBe('true')
  })
})
