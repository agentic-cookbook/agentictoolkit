/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TopicLevel } from '@agenticdevelopertoolkit/ui/blocks'
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
// The read is announced by ONE always-mounted live region whose TEXT changes, so the assertion is
// on what that region CONTAINS rather than on its presence: a region inserted at the same instant
// it fills announces nothing, since assistive tech reads a live region's mutations and not its
// arrival. `role="status"` also takes its name from the author and never from its content, so
// there is no accessible name to match on either.
const region = () => screen.getByRole('status')

describe('a published level re-registers when only `busy` changes', () => {
  it('shows the spinner after a busy-only flip', () => {
    const { rerender } = render(
      <StandaloneRailHost>
        <Pane busy={false} />
      </StandaloneRailHost>,
    )
    expect(region()).toBeEmptyDOMElement()

    rerender(
      <StandaloneRailHost>
        <Pane busy />
      </StandaloneRailHost>,
    )
    expect(region()).toHaveTextContent('Loading')
  })
})
