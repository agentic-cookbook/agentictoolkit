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

  it('is destructive, so Escape cannot discard', () => {
    const onDiscard = vi.fn()
    render(<UnsavedChangesAlert open onDiscard={onDiscard} onStay={vi.fn()} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDiscard).not.toHaveBeenCalled()
  })
})
