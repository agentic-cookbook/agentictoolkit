import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  InlineCommitControl,
  InlineEditableText,
  inlineCommitDeletingClass,
} from '../components/inline-commit-control'

describe('InlineCommitControl', () => {
  it('renders nothing when clean and not deletable', () => {
    const { container } = render(
      <InlineCommitControl dirty={false} onCommit={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('clean + deletable renders the hover trash which arms the delete', () => {
    const onDelete = vi.fn()
    render(
      <InlineCommitControl
        dirty={false}
        deletable
        onDelete={onDelete}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
        subject="flag beta"
      />,
    )
    const trash = screen.getByRole('button', { name: 'Delete flag beta' })
    fireEvent.click(trash)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('dirty shows the ✓/✕ pair wired to onCommit/onCancel', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(<InlineCommitControl dirty onCommit={onCommit} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('deleting shows ✓ ✕ and the armed red trash; ✓ commits, trash disarms', () => {
    const onCommit = vi.fn()
    const onDelete = vi.fn()
    render(
      <InlineCommitControl
        dirty={false}
        deleting
        deletable
        onDelete={onDelete}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    )
    const armed = screen.getByRole('button', { name: /delete armed/i })
    expect(armed.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    fireEvent.click(armed)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('busy disables the pair', () => {
    render(<InlineCommitControl dirty busy onCommit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled()
  })

  it('exports the deleting content class (dim + strikethrough)', () => {
    expect(inlineCommitDeletingClass).toContain('line-through')
  })
})

describe('InlineEditableText', () => {
  it('edits fire onChange; Enter commits; Escape cancels', () => {
    const onChange = vi.fn()
    const onCommitEdit = vi.fn()
    const onCancelEdit = vi.fn()
    render(
      <InlineEditableText
        value="beta"
        onChange={onChange}
        onCommitEdit={onCommitEdit}
        onCancelEdit={onCancelEdit}
        aria-label="Flag key"
      />,
    )
    const input = screen.getByLabelText('Flag key')
    fireEvent.change(input, { target: { value: 'beta2' } })
    expect(onChange).toHaveBeenCalledWith('beta2')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommitEdit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancelEdit).toHaveBeenCalledTimes(1)
  })
})
