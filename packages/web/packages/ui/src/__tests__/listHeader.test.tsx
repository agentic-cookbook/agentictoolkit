import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ListHeader } from '../blocks/list-header'

describe('ListHeader', () => {
  it('renders title, filter field, and actions in one bar', () => {
    const onChange = vi.fn()
    render(
      <ListHeader
        ariaLabel="Sites actions"
        title="Sites"
        search={{ value: '', onChange, placeholder: 'Filter 164 sites…' }}
        actions={<button type="button">+ New site</button>}
      />,
    )
    expect(screen.getByText('Sites')).toBeTruthy()
    const input = screen.getByRole('searchbox', { name: 'Filter' })
    fireEvent.change(input, { target: { value: 'olylo' } })
    expect(onChange).toHaveBeenCalledWith('olylo')
    expect(screen.getByRole('button', { name: '+ New site' })).toBeTruthy()
  })

  it('focuses the filter field on attach when autoFocus is set', () => {
    render(
      <ListHeader
        ariaLabel="Sites actions"
        search={{ value: '', onChange: vi.fn(), autoFocus: true }}
      />,
    )
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Filter' }))
  })

  it('omits the filter field when no search is supplied (action-only header)', () => {
    render(<ListHeader ariaLabel="Groups actions" title="Groups" actions={<button type="button">+ New group</button>} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByRole('button', { name: '+ New group' })).toBeTruthy()
  })
})
