/// <reference types="@testing-library/jest-dom/vitest" />
//
// A PANE THAT PUBLISHES NO LIST CAN STILL SAY IT IS READING.
//
// The spinner belongs to a topic list, and the pane doing the reading is usually a component BELOW
// the one that published that list — a group's member, a settings body. The member holds the only
// thing that knows a read is in flight; the group holds the only thing that can show it. Neither
// half can do this alone, which is what `useReportBusy` crosses.
//
// The alternative these tests rule out is the group hoisting its members' reads so it can pass
// `busy` itself: that fires every member's request the moment the group opens, to report the one
// the user actually asked for.
import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { StandaloneRailHost } from '../standalone-rail-host'
import { StackLevels, useReportBusy } from '../rail-host'

afterEach(cleanup)

/** A member's body: reads, publishes nothing, reports. The pane class this hook exists for. */
function Member({ busy }: { busy: boolean }) {
  useReportBusy(busy)
  return <p>member body</p>
}

const level = (id: string, title: string, busy?: boolean): TopicLevel => ({
  id,
  title,
  items: [{ id: 'a', label: 'Alpha' }],
  selectedId: 'a',
  onSelect: () => {},
  onClear: () => {},
  busy,
})

/** The list a pane's read is reported against is named by TITLE here, because the stack renders one
 *  `<aside>` per level and every one of them is called "Topic list". */
const listNamed = (title: string): HTMLElement => {
  const found = screen
    .getAllByRole('complementary', { name: 'Topic list' })
    .find((el) => within(el).queryByText(title))
  if (!found) throw new Error(`no topic list titled ${title}`)
  return found
}

/** Whether that list is announcing a read. The announcement is ONE always-mounted live region per
 *  list whose TEXT changes — a region that arrives with its message announces nothing, because
 *  assistive tech reads a live region's mutations rather than its insertion — so the question is
 *  what the region CONTAINS. It has no accessible name to ask for: `role="status"` takes its name
 *  from the author, never from its content. */
const spinning = (title: string): boolean =>
  within(listNamed(title)).getByRole('status').textContent === 'Loading'

describe('a reading pane lights the list it sits under', () => {
  it('spins the enclosing list while the pane reports, and stops when it stops', () => {
    const { rerender } = render(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)

    rerender(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy={false} />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(false)
  })

  it('stops when the reading pane unmounts mid-read', () => {
    // A user who clicks away while the request is still open. Without the withdrawal on unmount the
    // report outlives its reporter and the list spins forever, with nothing left on screen to
    // explain why.
    const { rerender } = render(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)

    rerender(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>{null}</StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(false)
  })

  it('lights the NEAREST list, not the outermost one', () => {
    // The stack is a chain: a feature publishes a list, its selected row publishes another, and the
    // read happens under the second. Reporting to the outer list would put the spinner in front of
    // a title the user is not waiting on.
    render(
      <StandaloneRailHost>
        <StackLevels levels={[level('outer', 'Products')]}>
          <StackLevels levels={[level('inner', 'Configuration')]}>
            <Member busy />
          </StackLevels>
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)
    expect(spinning('Products')).toBe(false)
  })

  it('keeps a list spinning while EITHER of two panes under it is still reading', () => {
    // Two panes can be mounted at once. Keyed by reporter, so the first to land does not clear the
    // second's spinner — the same reason `reportMissing` is keyed by item.
    const { rerender } = render(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy />
          <Member busy />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)

    rerender(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy={false} />
          <Member busy />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)

    rerender(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration')]}>
          <Member busy={false} />
          <Member busy={false} />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(false)
  })

  it('leaves a list its own publisher already called busy alone', () => {
    // A publisher that holds its own read stays the authority on it: the report can only ever raise
    // the flag, so a member finishing first cannot clear a spinner the group is still owed.
    render(
      <StandaloneRailHost>
        <StackLevels levels={[level('group', 'Configuration', true)]}>
          <Member busy={false} />
        </StackLevels>
      </StandaloneRailHost>,
    )
    expect(spinning('Configuration')).toBe(true)
  })

  it('is inert with no list above it', () => {
    // A reporting pane rendered outside any published level has nothing to light. It must not throw
    // and must not invent a list — the same no-op every other publisher hook takes.
    expect(() =>
      render(
        <StandaloneRailHost>
          <Member busy />
        </StandaloneRailHost>,
      ),
    ).not.toThrow()
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
  })
})
