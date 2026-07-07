import type * as React from 'react'
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

  it('busy soft-disables the pair (aria-disabled, clicks are no-ops) but keeps them focusable', () => {
    const onCommit = vi.fn()
    const onCancel = vi.fn()
    render(<InlineCommitControl dirty busy onCommit={onCommit} onCancel={onCancel} />)
    const save = screen.getByRole('button', { name: 'Save changes' })
    const discard = screen.getByRole('button', { name: 'Discard changes' })
    // aria-disabled (not the `disabled` attribute) so the button stays in the
    // tab order and keyboard focus survives the in-flight commit.
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(discard).toHaveAttribute('aria-disabled', 'true')
    expect(save).not.toBeDisabled()
    fireEvent.click(save)
    fireEvent.click(discard)
    expect(onCommit).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    // The group announces the in-flight state to assistive tech.
    expect(save.closest('[role="group"]')).toHaveAttribute('aria-busy', 'true')
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

  it('runs a consumer onKeyDown first and lets it suppress the Enter/Escape routing', () => {
    const onCommitEdit = vi.fn()
    const onKeyDown = vi.fn((e: React.KeyboardEvent) => e.preventDefault())
    render(
      <InlineEditableText
        value="beta"
        onChange={vi.fn()}
        onCommitEdit={onCommitEdit}
        onKeyDown={onKeyDown}
        aria-label="Flag key"
      />,
    )
    fireEvent.keyDown(screen.getByLabelText('Flag key'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onCommitEdit).not.toHaveBeenCalled() // suppressed by preventDefault
  })

  it('applies the mono variant class for identifier-style fields', () => {
    render(
      <InlineEditableText value="beta" onChange={vi.fn()} variant="mono" aria-label="Flag key" />,
    )
    expect(screen.getByLabelText('Flag key')).toHaveClass('font-mono')
  })
})
