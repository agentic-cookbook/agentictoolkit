/**
 * `useDetailTitle` — a pane naming what it is showing, in the detail header.
 *
 * The publisher/host split is the point: a feature pane cannot reach the stack that
 * renders it, so it PUBLISHES the title the same way it publishes its levels and its
 * busy state. This asserts the round trip through the standalone host, the withdrawal
 * on unmount (a stale title over an empty pane is worse than none), and that a pane
 * under NO host is simply quiet rather than broken.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { StandaloneRailHost } from '../standalone-rail-host'
import { useDetailTitle, useStackLevel } from '../rail-host'

function Pane({ title }: { title: string | null }) {
  useStackLevel({
    id: 'docs',
    title: 'Documents',
    items: [{ id: 'a', label: 'A paper' }],
    selectedId: 'a',
    onSelect: () => {},
    onClear: () => {},
  })
  useDetailTitle(title)
  return <div>pane</div>
}

afterEach(cleanup)

describe('useDetailTitle', () => {
  it('puts the published title in the host’s detail header', async () => {
    render(
      <StandaloneRailHost>
        <Pane title="Intelligence at the Edges" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Intelligence at the Edges')).toBeInTheDocument()
  })

  it('withdraws it when the pane publishes null', async () => {
    const { rerender } = render(
      <StandaloneRailHost>
        <Pane title="Intelligence at the Edges" />
      </StandaloneRailHost>,
    )
    expect(await screen.findByText('Intelligence at the Edges')).toBeInTheDocument()
    rerender(
      <StandaloneRailHost>
        <Pane title={null} />
      </StandaloneRailHost>,
    )
    expect(screen.queryByText('Intelligence at the Edges')).toBeNull()
  })

  it('is a no-op with no host — the hook must not require one', () => {
    expect(() => render(<Pane title="Orphan" />)).not.toThrow()
  })
})
