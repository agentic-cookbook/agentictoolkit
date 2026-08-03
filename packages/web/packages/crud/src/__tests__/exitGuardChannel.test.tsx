import { render, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useExitGuardChannel } from '../useExitGuardChannel'
import type { PaneExitGuard } from '@agentic-toolkit/ui/blocks'

const DIRTY: PaneExitGuard = { isDirty: () => true, save: async () => true }

let published: PaneExitGuard | null = null
let register: (g: PaneExitGuard | null) => void = () => {}

function Host() {
  const { exitGuard, registerGuard } = useExitGuardChannel()
  published = exitGuard
  register = registerGuard
  return null
}

describe('useExitGuardChannel', () => {
  it('publishes null until a guard is registered', () => {
    render(<Host />)
    expect(published).toBeNull()
  })

  it('publishes a guard once one is registered, and null again when withdrawn', () => {
    render(<Host />)
    act(() => register(DIRTY))
    expect(published).not.toBeNull()
    expect(published!.isDirty()).toBe(true)

    act(() => register(null))
    expect(published).toBeNull()
  })

  it('keeps one stable proxy identity across re-registrations', () => {
    render(<Host />)
    act(() => register(DIRTY))
    const first = published
    act(() => register({ isDirty: () => true, save: async () => true }))
    expect(published).toBe(first)
  })
})
