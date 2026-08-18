import * as React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProgressModal } from '../blocks/progress-modal'

/**
 * The FOOTER's Close, not the dialog's ×. `showClose={finished}` means that once the run has
 * ended there are two buttons whose accessible name is "Close" — the corner dismiss (an
 * `aria-label`) and the footer button (its text) — so an unscoped query matches both and
 * throws. Both are genuinely "Close" to a screen reader, which is why the test narrows its
 * scope rather than renaming one of them.
 */
function footerButton(name: string): HTMLElement {
  const footer = document.querySelector('[data-slot="dialog-footer"]')
  if (!(footer instanceof HTMLElement)) throw new Error('the dialog rendered no footer')
  return within(footer).getByRole('button', { name })
}

describe('ProgressModal', () => {
  it('reports progress as a percentage of the total', () => {
    render(<ProgressModal open title="Moving users" total={4} done={1} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')
  })

  it('shows a zero-length bar rather than dividing by zero', () => {
    // An empty batch should never have been started, but NaN in aria-valuenow is a crash the
    // operator sees as a broken dialog rather than as the empty batch it is.
    render(<ProgressModal open title="Moving users" total={0} done={0} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('names the item in flight and counts what is done', () => {
    render(<ProgressModal open title="Moving users" total={3} done={1} currentLabel="mike@t.co" />)
    expect(screen.getByText('mike@t.co')).toBeTruthy()
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('offers neither Continue, Stop nor Close while a run is healthy', () => {
    render(
      <ProgressModal
        open
        title="Moving users"
        total={3}
        done={1}
        onContinue={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('offers Continue and Stop, and names the failure, once halted on an error', () => {
    // Spec §3 decision 2: the run HALTS on the first failure and asks. It does not power through
    // and hand back a list at the end — the operator gets to decide whether the rest should go.
    render(
      <ProgressModal
        open
        title="Moving users"
        total={3}
        done={1}
        error={{ message: 'email already taken in the target', itemLabel: 'bob@t.co' }}
        onContinue={vi.fn()}
        onStop={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(screen.getByText('email already taken in the target')).toBeTruthy()
    expect(screen.getByText('bob@t.co')).toBeTruthy()
  })

  it('Continue and Stop call their handlers', () => {
    const onContinue = vi.fn()
    const onStop = vi.fn()
    render(
      <ProgressModal
        open
        title="Moving users"
        total={3}
        done={1}
        error={{ message: 'nope' }}
        onContinue={onContinue}
        onStop={onStop}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('offers Close once finished, and no Continue or Stop', () => {
    render(
      <ProgressModal open finished title="Moving users" total={3} done={3} onClose={vi.fn()} onContinue={vi.fn()} />,
    )
    expect(footerButton('Close')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  })

  it('offers Close after a Stop, even though done is short of total', () => {
    // A stopped run is finished. Deriving finished from done === total would leave the operator
    // holding a modal they cannot dismiss.
    render(<ProgressModal open finished title="Moving users" total={3} done={1} onClose={vi.fn()} />)
    expect(footerButton('Close')).toBeTruthy()
  })

  it('logs every item, ok and failed alike, and keeps the log after the run ends', () => {
    // The point of staying open. A modal that closes itself on completion takes the only record
    // of what happened with it, and the operator is left with a partly-moved batch and no list.
    render(
      <ProgressModal
        open
        finished
        title="Moving users"
        total={2}
        done={1}
        onClose={vi.fn()}
        results={[
          { id: 'u1', label: 'alice@t.co', status: 'ok' },
          { id: 'u2', label: 'bob@t.co', status: 'failed', message: 'email already taken' },
        ]}
      />,
    )
    expect(screen.getByText('alice@t.co')).toBeTruthy()
    expect(screen.getByText('bob@t.co')).toBeTruthy()
    expect(screen.getByText('email already taken')).toBeTruthy()
  })

  it('Close calls onClose', () => {
    const onClose = vi.fn()
    render(<ProgressModal open finished title="Moving users" total={1} done={1} onClose={onClose} />)
    fireEvent.click(footerButton('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
