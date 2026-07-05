/** Unit tests for PermissionToggles — the four C/R/U/D chips with parent-clamp. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PermissionToggles } from '../components/permission-toggles'
import { noAccess, readOnly, type Crud } from '../components/crud'

const all: Crud = { create: true, read: true, update: true, delete: true }

describe('PermissionToggles', () => {
  it('renders four chips with aria-pressed reflecting the value', () => {
    render(<PermissionToggles value={readOnly()} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'R' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'C' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('toggling a capability emits the flipped value', () => {
    const onChange = vi.fn()
    render(<PermissionToggles value={noAccess()} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(onChange).toHaveBeenCalledWith({ create: true, read: false, update: false, delete: false })
  })

  it('a parent-forbidden capability is disabled, forced off, and a no-op on click', () => {
    const onChange = vi.fn()
    const parent: Crud = { create: false, read: true, update: true, delete: true }
    // value claims create=true, but parent forbids it → must render off + disabled.
    render(<PermissionToggles value={all} parent={parent} onChange={onChange} />)
    const create = screen.getByRole('button', { name: 'C' })
    expect(create).toBeDisabled()
    expect(create).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(create)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disabled blocks every toggle', () => {
    const onChange = vi.fn()
    render(<PermissionToggles value={noAccess()} disabled onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'R' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
