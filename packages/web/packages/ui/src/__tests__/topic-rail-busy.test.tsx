/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TopicRail } from '../blocks/topic-detail'

afterEach(cleanup)

const props = {
  items: [{ id: 'a', label: 'Alpha' }],
  selectedId: null,
  onSelect: () => {},
  emptyLabel: 'Nothing here yet.',
  collapsed: false,
  onToggle: () => {},
  title: 'Topics',
}

describe('the topic list busy spinner', () => {
  it('is absent when the list is not busy', () => {
    render(<TopicRail {...props} />)
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
  })

  it('appears when the list is busy', () => {
    render(<TopicRail {...props} busy />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  // The title must not move when the spinner appears (Mike). It hangs OFF the title's left edge,
  // absolutely positioned, exactly as the `+` hangs off its right edge.
  it('is taken out of flow so the title does not shift', () => {
    render(<TopicRail {...props} busy />)
    const spinner = screen.getByRole('status', { name: 'Loading' })
    expect(spinner.parentElement?.className).toContain('absolute')
    expect(spinner.parentElement?.className).toContain('right-full')
  })
})
