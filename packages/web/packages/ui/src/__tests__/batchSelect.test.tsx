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

  it('a changed resetKey drops the selection, in the SAME render', () => {
    // The other way a selected row leaves the screen: the list pages, searches or filters, and
    // `active` never moves. The count must be zero on the commit that shows the new rows — an
    // effect-based reset would let one paint through with a Transfer button enabled and a count
    // describing rows nobody can see.
    function PageHarness(): React.ReactElement {
      const [page, setPage] = React.useState(1)
      const batch = useBatchSelect({ resetKey: page })
      return (
        <div>
          <span data-testid="count">{batch.count}</span>
          <span data-testid="page">{page}</span>
          <button type="button" onClick={() => batch.setSelectedIds(new Set(['a', 'b']))}>pick two</button>
          <button type="button" onClick={() => setPage((p) => p + 1)}>next page</button>
        </div>
      )
    }
    render(<PageHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'pick two' }))
    expect(screen.getByTestId('count').textContent).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'next page' }))
    expect(screen.getByTestId('page').textContent).toBe('2')
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('leaves the selection alone while the resetKey holds still', () => {
    // The failure the ref guards: a resetKey compared by identity rather than remembered would
    // clear on every render, and a selection could never be built at all.
    function SteadyHarness(): React.ReactElement {
      const [ticks, setTicks] = React.useState(0)
      const batch = useBatchSelect({ resetKey: 'page-1' })
      return (
        <div>
          <span data-testid="count">{batch.count}</span>
          <span data-testid="ticks">{ticks}</span>
          <button type="button" onClick={() => batch.setSelectedIds(new Set(['a']))}>pick</button>
          <button type="button" onClick={() => setTicks((t) => t + 1)}>rerender</button>
        </div>
      )
    }
    render(<SteadyHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'pick' }))
    fireEvent.click(screen.getByRole('button', { name: 'rerender' }))
    fireEvent.click(screen.getByRole('button', { name: 'rerender' }))
    expect(screen.getByTestId('ticks').textContent).toBe('2')
    expect(screen.getByTestId('count').textContent).toBe('1')
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
