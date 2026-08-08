import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ReactionBar, DEFAULT_REACTIONS } from '../components/reaction-bar'

// The bar is presentational: the caller owns the tallies and the write. So what is worth pinning
// is the part a caller CANNOT see from the props — that a chip is a toggle rather than an "add",
// that the pressed state is announced rather than only coloured, and that the two ways to react
// (a chip, the palette) call the same handler with the same argument.
describe('ReactionBar', () => {
  const bar = (over: Partial<Parameters<typeof ReactionBar>[0]> = {}) => {
    const onToggle = vi.fn()
    render(
      <ReactionBar
        reactions={[
          { emoji: '👍', count: 2, mine: true },
          { emoji: '🎉', count: 1, mine: false },
        ]}
        onToggle={onToggle}
        subjectLabel="Ada’s comment"
        {...over}
      />,
    )
    return onToggle
  }

  it('names each chip by its emoji, its count and its subject', () => {
    bar()
    expect(screen.getByRole('button', { name: '👍 2 on Ada’s comment' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '🎉 1 on Ada’s comment' })).toBeTruthy()
  })

  it('announces the viewer’s own reaction as PRESSED, not merely as coloured', () => {
    bar()
    expect(screen.getByRole('button', { name: /👍/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /🎉/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('pressing a chip you are part of asks to TAKE IT BACK, with the same call', () => {
    // One handler, one argument, both directions — the caller decides add-vs-remove from the
    // tally it already holds, so the bar never has to carry two callbacks that can disagree.
    const onToggle = bar()
    fireEvent.click(screen.getByRole('button', { name: /👍/ }))
    expect(onToggle).toHaveBeenCalledWith('👍')
  })

  it('offers the palette’s emoji through the same toggle', () => {
    const onToggle = bar()
    fireEvent.click(screen.getByRole('button', { name: 'React to Ada’s comment' }))
    fireEvent.click(screen.getByRole('button', { name: `React ${DEFAULT_REACTIONS[1]} to Ada’s comment` }))
    expect(onToggle).toHaveBeenCalledWith(DEFAULT_REACTIONS[1])
  })

  it('goes inert while a write is in flight, without hiding or re-ordering anything', () => {
    // A bar that dropped its chips mid-write would move the pointer's target between the press
    // and the result; the counts stay exactly where they were and simply stop responding.
    bar({ busy: true })
    expect((screen.getByRole('button', { name: /👍/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /🎉/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByRole('button', { name: /on Ada’s comment/ })).toHaveLength(2)
  })

  it('still shows the counts to a viewer who may not react, but offers no way in', () => {
    bar({ disabled: true })
    expect(screen.getByRole('button', { name: /👍 2/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'React to Ada’s comment' })).toBeNull()
  })

  it('renders nothing but the palette trigger when a subject has no reactions yet', () => {
    bar({ reactions: [] })
    expect(screen.queryByRole('button', { name: /on Ada’s comment/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'React to Ada’s comment' })).toBeTruthy()
  })
})
