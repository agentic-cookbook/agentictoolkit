import * as React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BatchSelectButton, useBatchSelect } from '../blocks/batch-select'

function Harness(): React.ReactElement {
  const batch = useBatchSelect()
  return (
    <div>
      <BatchSelectButton batch={batch} />
      <span data-testid="active">{String(batch.active)}</span>
      <span data-testid="count">{batch.count}</span>
      <button type="button" onClick={() => batch.setSelectedIds(new Set(['a', 'b']))}>
        pick two
      </button>
    </div>
  )
}

describe('useBatchSelect', () => {
  it('starts inactive with nothing selected', () => {
    render(<Harness />)
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy()
  })

  it('the button reads Done while active', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByTestId('active').textContent).toBe('true')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('leaving batch mode CLEARS the selection', () => {
    // The reason this is shared. A surface that hides the checkboxes but keeps the ids has an
    // invisible selection, and the next bulk action operates on rows the user cannot see.
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick two' }))
    expect(screen.getByTestId('count').textContent).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('re-entering batch mode starts empty', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick two' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('clear() empties the selection without leaving batch mode', () => {
    function ClearHarness(): React.ReactElement {
      const batch = useBatchSelect()
      return (
        <div>
          <span data-testid="active">{String(batch.active)}</span>
          <span data-testid="count">{batch.count}</span>
          <button type="button" onClick={() => batch.setSelectedIds(new Set(['a']))}>pick</button>
          <button type="button" onClick={batch.clear}>clear</button>
          <button type="button" onClick={batch.toggleActive}>toggle</button>
        </div>
      )
    }
    render(<ClearHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick' }))
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.getByTestId('active').textContent).toBe('true')
  })
})
