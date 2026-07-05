/** Unit tests for the shared Button's pointer-driven pressed state (c8). The
 *  pressed *visual* is CSS (data-[pressed]:* utilities); here we assert the
 *  `data-pressed` reflection that drives it. The real visual dip + DOM focus are
 *  covered by app-level Playwright. Interactions use fireEvent (no userEvent),
 *  matching the other shared/ui component tests. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../components/button'

describe('Button (pressed state)', () => {
  it('sets data-pressed on pointerdown inside and clears it on pointerup', () => {
    render(<Button>Press me</Button>)
    const button = screen.getByRole('button', { name: 'Press me' })
    expect(button).not.toHaveAttribute('data-pressed')

    fireEvent.pointerDown(button)
    expect(button).toHaveAttribute('data-pressed')

    fireEvent.pointerUp(button)
    expect(button).not.toHaveAttribute('data-pressed')
  })

  it('clears data-pressed when the pointer leaves while held, and restores it on re-enter', () => {
    render(<Button>Hold me</Button>)
    const button = screen.getByRole('button', { name: 'Hold me' })

    fireEvent.pointerDown(button)
    expect(button).toHaveAttribute('data-pressed')

    // Pointer leaves while still held → the pressed visual drops…
    fireEvent.pointerLeave(button)
    expect(button).not.toHaveAttribute('data-pressed')

    // …and is restored if the pointer comes back before release.
    fireEvent.pointerEnter(button)
    expect(button).toHaveAttribute('data-pressed')
  })

  it('forwards a consumer pointer handler alongside the pressed tracking', () => {
    const onPointerDown = vi.fn()
    render(<Button onPointerDown={onPointerDown}>Click</Button>)
    const button = screen.getByRole('button', { name: 'Click' })

    fireEvent.pointerDown(button)
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('data-pressed')
  })
})
