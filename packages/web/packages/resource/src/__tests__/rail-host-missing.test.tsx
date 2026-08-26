/// <reference types="@testing-library/jest-dom/vitest" />
import { useState } from 'react'
import { render, screen, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TopicLevel } from '@agenticdevelopertoolkit/ui/blocks'
import { StandaloneRailHost } from '../standalone-rail-host'
import { StackLevels, useReportMissing, useRailExitGuard } from '../rail-host'

afterEach(cleanup)

const ALERT_TITLE = 'That item is no longer there'

const level = (id: string, selectedId: string | null, onClear: () => void): TopicLevel => ({
  id,
  title: id,
  items: [{ id: 'row', label: 'Row' }],
  selectedId,
  onSelect: () => {},
  onClear,
})

function Pane({
  levels,
  missingId,
  dirty = false,
}: {
  levels: TopicLevel[]
  missingId: string | null
  dirty?: boolean
}) {
  useReportMissing(missingId, missingId != null)
  useRailExitGuard(dirty ? { isDirty: () => true } : null)
  return <StackLevels levels={levels}>{null}</StackLevels>
}

/** A pane that reports and nothing else, so it can be unmounted on its own. */
function Reporter({ id }: { id: string }) {
  useReportMissing(id, true)
  return <p>pane body</p>
}

/** Two levels where clearing the inner one REALLY pops it — the leaf goes, and the pane reporting
 *  under it unmounts with it.
 *
 *  That unmount is the whole mechanism: on a successful pop the host deliberately leaves `missing`
 *  alone and lets each pane's own `useReportMissing` cleanup withdraw exactly its own id, because
 *  clearing centrally would also drop a SECOND pane's still-true report, which that pane never
 *  re-publishes. So a harness whose `onClear` is a bare spy leaves the alert standing — correctly,
 *  and for a reason no product path ever hits. */
function PoppingStack({ onClearInner }: { onClearInner: () => void }) {
  const [innerOpen, setInnerOpen] = useState(true)
  const levels = innerOpen
    ? [
        level('outer', 'o1', vi.fn()),
        level('inner', 'i1', () => {
          onClearInner()
          setInnerOpen(false)
        }),
      ]
    : [level('outer', 'o1', vi.fn())]
  return <StackLevels levels={levels}>{innerOpen ? <Reporter id="gone-2" /> : null}</StackLevels>
}

describe('the host-owned missing-item alert', () => {
  it('shows the approved copy when a pane reports its item is gone', () => {
    render(
      <StandaloneRailHost>
        <Pane levels={[level('outer', 'o1', vi.fn())]} missingId="gone-1" />
      </StandaloneRailHost>,
    )
    expect(screen.getByText(ALERT_TITLE)).toBeInTheDocument()
    expect(
      screen.getByText(
        'It was moved or deleted on the server since you last loaded it. Returning you to the list.',
      ),
    ).toBeInTheDocument()
  })

  it('pops the stack when the alert is acknowledged, and hides itself', async () => {
    const clearInner = vi.fn()
    render(
      <StandaloneRailHost>
        <PoppingStack onClearInner={clearInner} />
      </StandaloneRailHost>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'OK' }).click()
    })
    expect(clearInner).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument()
  })

  // The pop that has nothing to pop: a single-record topic, published with no selection above it.
  // Nothing unmounts, so nothing withdraws the report — the host has to clear it itself, or the
  // alert re-opens on the next render and the user is stuck behind it with no way through.
  it('clears the report itself when there was nothing to pop', async () => {
    render(
      <StandaloneRailHost>
        <Pane levels={[level('only', null, vi.fn())]} missingId="gone-4" />
      </StandaloneRailHost>,
    )
    expect(screen.getByText(ALERT_TITLE)).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: 'OK' }).click()
    })
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument()
  })

  // An alert that popped the stack out from under an unsaved editor would discard the user's work
  // in order to tell them the work's target is gone. The REPORT stands; only the alert waits.
  it('stays hidden while a pane is dirty', () => {
    render(
      <StandaloneRailHost>
        <Pane levels={[level('outer', 'o1', vi.fn())]} missingId="gone-3" dirty />
      </StandaloneRailHost>,
    )
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument()
  })

  it('shows nothing when no pane reports anything', () => {
    render(
      <StandaloneRailHost>
        <Pane levels={[level('outer', 'o1', vi.fn())]} missingId={null} />
      </StandaloneRailHost>,
    )
    expect(screen.queryByText(ALERT_TITLE)).not.toBeInTheDocument()
  })
})
