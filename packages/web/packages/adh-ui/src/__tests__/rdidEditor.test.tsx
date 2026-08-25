import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RdidEditor } from '../components/rdid-editor'

describe('RdidEditor', () => {
  it('shows the fixed prefix and edits only the leaf (lowercased)', () => {
    const onChange = vi.fn()
    render(<RdidEditor label="Id" prefix="app.my-eco." value="cookbook" onChange={onChange} />)
    expect(screen.getByText('app.my-eco.')).toBeTruthy()
    const input = screen.getByLabelText('Id') as HTMLInputElement
    expect(input.value).toBe('cookbook')
    fireEvent.change(input, { target: { value: 'New-App' } })
    expect(onChange).toHaveBeenCalledWith('new-app')
  })

  it('edits the whole value in empty-prefix mode', () => {
    const onChange = vi.fn()
    render(<RdidEditor label="Id" prefix="" value="app.a.b" onChange={onChange} />)
    const input = screen.getByLabelText('Id') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'APP.A.C' } })
    expect(onChange).toHaveBeenCalledWith('app.a.c')
  })

  it('shows an error in place of the hint', () => {
    render(<RdidEditor label="Id" prefix="persona." value="" onChange={() => {}} hint="the hint" error="bad" />)
    expect(screen.getByText('bad')).toBeTruthy()
    expect(screen.queryByText('the hint')).toBeNull()
  })

  it('renders the hint when there is no error', () => {
    render(<RdidEditor label="Id" prefix="persona." value="bob" onChange={() => {}} hint="the hint" />)
    expect(screen.getByText('the hint')).toBeTruthy()
  })
})
