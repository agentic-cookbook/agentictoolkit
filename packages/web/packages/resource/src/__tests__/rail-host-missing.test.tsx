/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
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
        <Pane
          levels={[level('outer', 'o1', vi.fn()), level('inner', 'i1', clearInner)]}
          missingId="gone-2"
        />
      </StandaloneRailHost>,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'OK' }).click()
    })
    expect(clearInner).toHaveBeenCalledTimes(1)
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
