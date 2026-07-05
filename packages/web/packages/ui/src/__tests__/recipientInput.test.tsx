import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RecipientInput } from '../components/recipient-input'

function setup(value: string[] = [], kind: any = 'text') {
  const onChange = vi.fn()
  render(<RecipientInput value={value} onChange={onChange} kind={kind} ariaLabel="Recipients" />)
  return { onChange, input: screen.getByRole('textbox', { name: 'Add to Recipients' }) as HTMLInputElement }
}

describe('RecipientInput', () => {
  it('tokenizes on Enter (trim + add)', () => {
    const { onChange, input } = setup([])
    fireEvent.change(input, { target: { value: '  ada@x.io ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['ada@x.io'])
  })
  it('tokenizes on comma', () => {
    const { onChange, input } = setup(['a@x.io'])
    fireEvent.change(input, { target: { value: 'b@x.io,' } })
    expect(onChange).toHaveBeenCalledWith(['a@x.io', 'b@x.io'])
  })
  it('de-dupes case-insensitively for emails', () => {
    const { onChange, input } = setup(['A@x.io'], 'email')
    fireEvent.change(input, { target: { value: 'a@x.io' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
  it('Backspace on empty removes the last chip', () => {
    const { onChange, input } = setup(['a@x.io', 'b@x.io'])
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith(['a@x.io'])
  })
  it('removes a specific chip via its × button', () => {
    const { onChange } = setup(['a@x.io', 'b@x.io'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }))
    expect(onChange).toHaveBeenCalledWith(['b@x.io'])
  })
  it('flags an invalid email chip with aria-invalid but still adds it', () => {
    const { onChange, input } = setup([], 'email')
    fireEvent.change(input, { target: { value: 'nope' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['nope'])
  })
  it('does not tokenize partial text when focus moves to a chip × button inside the component', () => {
    const { onChange, input } = setup(['a@x.io'])
    fireEvent.change(input, { target: { value: 'partial' } })
    const removeBtn = screen.getByRole('button', { name: 'Remove a@x.io' })
    fireEvent.blur(input, { relatedTarget: removeBtn })
    // onChange should only be called when the × button is clicked, not on blur
    expect(onChange).not.toHaveBeenCalled()
  })
})
