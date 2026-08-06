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

  // Reported from the org-rename settings pane: "the Stay button should not be Red."
  // Stay is `variant="outline"`, so its only colour-bearing classes are the input
  // border/background and the focus ring — and the ring is the one a theme can turn
  // red, because `destructive` autofocuses Stay and the ring is the theme accent.
  it('keeps every alarm colour on Discard, and none of it on Stay', () => {
    render(<UnsavedChangesAlert open onDiscard={vi.fn()} onStay={vi.fn()} />)
    const stay = screen.getByRole('button', { name: 'Stay' })
    const discard = screen.getByRole('button', { name: 'Discard' })

    // Stay is focused the moment the alert opens, so whatever its ring is, it is on
    // screen unprompted.
    expect(document.activeElement).toBe(stay)
    // Not a blanket search for "destructive": every Button carries `aria-invalid:*`
    // destructive classes that only fire on an invalid control. These are the classes
    // that paint unconditionally.
    for (const red of [
      'bg-destructive/15',
      'text-destructive',
      'focus-visible:ring-destructive',
      'apt-red',
      'ring-ring/50',
    ]) {
      expect(stay.className).not.toContain(red)
    }
    expect(stay.className).toContain('focus-visible:ring-apt-text/40')

    // The pair only carries a signal if exactly one side of it is loud.
    expect(discard.className).toContain('bg-destructive/15')
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
