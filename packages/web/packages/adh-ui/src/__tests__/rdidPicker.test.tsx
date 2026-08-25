import * as React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RdidPicker, type RdidOption } from '../blocks/rdid-picker'

const OPTIONS: RdidOption[] = [
  { rdid: 'ecosystem.acme', entityType: 'ecosystem', entityId: 'e1' },
  { rdid: 'ecosystem.acme-corp', entityType: 'ecosystem', entityId: 'e2' },
]

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => vi.useRealTimers())

function setup(search: RdidPickerProps['search'], onPick = vi.fn()) {
  render(<RdidPicker open onOpenChange={vi.fn()} onPick={onPick} search={search} />)
  return { onPick }
}
type RdidPickerProps = React.ComponentProps<typeof RdidPicker>

describe('RdidPicker', () => {
  it('searches once for a burst of keystrokes, with the FINAL query', async () => {
    // Without the debounce every keystroke is a round trip to a table with no RLS — and the
    // replies can land out of order, so the list settles on whichever request was slowest.
    const search = vi.fn().mockResolvedValue(OPTIONS)
    setup(search)
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'e' } })
    fireEvent.change(field, { target: { value: 'ec' } })
    fireEvent.change(field, { target: { value: 'eco' } })
    expect(search).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1))
    expect(search.mock.calls[0]![0]).toBe('eco')
  })

  it('lists what the search returned', async () => {
    setup(vi.fn().mockResolvedValue(OPTIONS))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acme' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(screen.getByText('ecosystem.acme')).toBeTruthy())
    expect(screen.getByText('ecosystem.acme-corp')).toBeTruthy()
  })

  it('hands the WHOLE option back, not just the string', async () => {
    // The caller needs entityId: the transfer targets an ecosystem by id, and re-resolving the
    // rdid it just picked is a second lookup that can disagree with the first.
    const { onPick } = setup(vi.fn().mockResolvedValue(OPTIONS))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acme' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(screen.getByText('ecosystem.acme')).toBeTruthy())
    fireEvent.click(screen.getByText('ecosystem.acme'))
    expect(onPick).toHaveBeenCalledWith(OPTIONS[0])
  })

  it('surfaces a failed search instead of showing an empty list', async () => {
    setup(vi.fn().mockRejectedValue(new Error('registry unreachable')))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acme' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(screen.getByText('registry unreachable')).toBeTruthy())
  })

  it('does not fire a search for an empty field', async () => {
    const search = vi.fn().mockResolvedValue([])
    setup(search)
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'a' } })
    fireEvent.change(field, { target: { value: '' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(search).not.toHaveBeenCalled())
  })

  it('aborts a search that a newer keystroke has superseded', async () => {
    const seen: AbortSignal[] = []
    const search = vi.fn(async (_q: string, signal: AbortSignal) => {
      seen.push(signal)
      return OPTIONS
    })
    setup(search)
    const field = screen.getByRole('combobox')
    fireEvent.change(field, { target: { value: 'ac' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(seen).toHaveLength(1))
    fireEvent.change(field, { target: { value: 'acm' } })
    act(() => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(seen).toHaveLength(2))
    expect(seen[0]!.aborted).toBe(true)
  })
})
