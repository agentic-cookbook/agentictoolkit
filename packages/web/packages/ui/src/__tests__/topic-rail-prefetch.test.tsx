/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TopicRail } from '../blocks/topic-detail'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

const props = {
  items: [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ],
  selectedId: null,
  onSelect: () => {},
  emptyLabel: 'Nothing here yet.',
  collapsed: false,
  onToggle: () => {},
  title: 'Topics',
}

describe('topic list prefetch on intent', () => {
  it('fires after the dwell when the pointer rests on a row', () => {
    const onPrefetch = vi.fn()
    render(<TopicRail {...props} onPrefetch={onPrefetch} />)

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Alpha' }))
    expect(onPrefetch).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(100))
    expect(onPrefetch).toHaveBeenCalledWith('a')
  })

  // Sweeping the pointer down a list must not fire a read per row — that would cost MORE requests
  // than the problem this whole change exists to fix.
  it('does not fire for a row the pointer only passes over', () => {
    const onPrefetch = vi.fn()
    render(<TopicRail {...props} onPrefetch={onPrefetch} />)

    const alpha = screen.getByRole('button', { name: 'Alpha' })
    fireEvent.pointerEnter(alpha)
    act(() => void vi.advanceTimersByTime(40))
    fireEvent.pointerLeave(alpha)
    act(() => void vi.advanceTimersByTime(200))

    expect(onPrefetch).not.toHaveBeenCalled()
  })

  // Keyboard users arrive at a row by focusing it; the intent is identical.
  it('fires on keyboard focus too', () => {
    const onPrefetch = vi.fn()
    render(<TopicRail {...props} onPrefetch={onPrefetch} />)

    fireEvent.focus(screen.getByRole('button', { name: 'Beta' }))
    act(() => void vi.advanceTimersByTime(100))
    expect(onPrefetch).toHaveBeenCalledWith('b')
  })

  it('does nothing at all when the level declares no prefetch', () => {
    render(<TopicRail {...props} />)
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Alpha' }))
    expect(() => act(() => void vi.advanceTimersByTime(200))).not.toThrow()
  })
})
