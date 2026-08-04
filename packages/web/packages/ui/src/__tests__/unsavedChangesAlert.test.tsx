import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnsavedChangesAlert } from '../components/unsaved-changes-alert'

describe('UnsavedChangesAlert', () => {
  it('renders exactly two buttons — no Save affordance', () => {
    render(<UnsavedChangesAlert open onDiscard={vi.fn()} onStay={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
  })

  it('renders nothing when closed', () => {
    render(<UnsavedChangesAlert open={false} onDiscard={vi.fn()} onStay={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('routes the two buttons to the two callbacks', () => {
    const onDiscard = vi.fn()
    const onStay = vi.fn()
    render(<UnsavedChangesAlert open onDiscard={onDiscard} onStay={onStay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onStay).not.toHaveBeenCalled()
  })

  // Most mounts now gate a DIALOG dismissal rather than a page exit, so the default sentence
  // may not say "if you leave" — the user closing a modal is not leaving anything.
  it('describes the loss in wording that holds for a dialog dismissal as well as a page exit', () => {
    render(<UnsavedChangesAlert open onDiscard={vi.fn()} onStay={vi.fn()} />)
    expect(screen.getByText('Your unsaved changes will be lost.')).toBeInTheDocument()
  })

  it('lets a surface name what is at risk, leaving the title and both buttons fixed', () => {
    render(
      <UnsavedChangesAlert
        open
        description="The users you have added will be lost."
        onDiscard={vi.fn()}
        onStay={vi.fn()}
      />,
    )
    expect(screen.getByText('The users you have added will be lost.')).toBeInTheDocument()
    expect(screen.queryByText('Your unsaved changes will be lost.')).toBeNull()
    // The override reaches the description ONLY: the consistency guarantee is the title
    // and the two labels, and no prop may move them.
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeInTheDocument()
  })

  it('is destructive, so Escape cannot discard', () => {
    const onDiscard = vi.fn()
    const onStay = vi.fn()
    render(<UnsavedChangesAlert open onDiscard={onDiscard} onStay={onStay} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onDiscard).not.toHaveBeenCalled()
    expect(onStay).not.toHaveBeenCalled()
  })
})
