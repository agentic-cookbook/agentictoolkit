/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { StandaloneRailHost } from '../standalone-rail-host'
import { StackLevels } from '../rail-host'

afterEach(cleanup)

const level = (busy: boolean): TopicLevel => ({
  id: 'topics',
  title: 'Topics',
  items: [{ id: 'a', label: 'Alpha' }],
  selectedId: null,
  onSelect: () => {},
  onClear: () => {},
  busy,
})

function Pane({ busy }: { busy: boolean }) {
  return <StackLevels levels={[level(busy)]}>{null}</StackLevels>
}

// `levelsKey` decides when a published level is re-registered. It serialises the fields the merged
// stack renders — and `busy` is now one of them. Left out, a level that flips ONLY its busy flag
// keeps the old key, never re-registers, and the spinner never appears: the flag would look wired
// (it typechecks, it renders in isolation) and do nothing in the host.
describe('a published level re-registers when only `busy` changes', () => {
  it('shows the spinner after a busy-only flip', () => {
    const { rerender } = render(
      <StandaloneRailHost>
        <Pane busy={false} />
      </StandaloneRailHost>,
    )
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()

    rerender(
      <StandaloneRailHost>
        <Pane busy />
      </StandaloneRailHost>,
    )
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})
