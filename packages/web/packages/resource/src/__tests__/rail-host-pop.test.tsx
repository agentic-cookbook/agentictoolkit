/// <reference types="@testing-library/jest-dom/vitest" />
import { render, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TopicLevel } from '@agenticdevelopertoolkit/ui/blocks'
import { StandaloneRailHost } from '../standalone-rail-host'
import { StackLevels, useStackPop } from '../rail-host'

afterEach(cleanup)

const level = (id: string, selectedId: string | null, onClear: () => void): TopicLevel => ({
  id,
  title: id,
  items: [{ id: 'row', label: 'Row' }],
  selectedId,
  onSelect: () => {},
  onClear,
})

/** Publishes `levels` and hands its caller the pop, so a test can fire it from inside the host. */
function Pane({ levels, onReady }: { levels: TopicLevel[]; onReady: (pop: () => void) => void }) {
  const pop = useStackPop()
  onReady(pop)
  return <StackLevels levels={levels}>{null}</StackLevels>
}

describe('useStackPop', () => {
  it('clears the DEEPEST selected level, leaving its ancestors alone', () => {
    const clearOuter = vi.fn()
    const clearInner = vi.fn()
    let pop!: () => void

    render(
      <StandaloneRailHost>
        <Pane
          levels={[level('outer', 'o1', clearOuter), level('inner', 'i1', clearInner)]}
          onReady={(p) => (pop = p)}
        />
      </StandaloneRailHost>,
    )

    act(() => pop())

    expect(clearInner).toHaveBeenCalledTimes(1)
    expect(clearOuter).not.toHaveBeenCalled()
  })

  it('does nothing when nothing is selected — there is no leaf to pop', () => {
    const clearOuter = vi.fn()
    let pop!: () => void

    render(
      <StandaloneRailHost>
        <Pane levels={[level('outer', null, clearOuter)]} onReady={(p) => (pop = p)} />
      </StandaloneRailHost>,
    )

    act(() => pop())

    expect(clearOuter).not.toHaveBeenCalled()
  })

  it('is a safe no-op with no host above it', () => {
    let pop!: () => void
    function Bare() {
      pop = useStackPop()
      return null
    }
    render(<Bare />)
    expect(() => act(() => pop())).not.toThrow()
  })
})
