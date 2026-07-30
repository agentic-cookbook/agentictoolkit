// Tests for AppErrorBoundary, RouteError, and GlobalError layout components.
//
// Strategy for AppErrorBoundary: @sentry/react's ErrorBoundary IS a real
// React error boundary, but it calls Sentry SDK internals (XHR, fetch, timers)
// that don't work cleanly in jsdom. We mock the whole @sentry/react module so
// ErrorBoundary is a minimal but functional boundary — same public behaviour
// (catches render errors, renders the fallback prop) without touching the SDK.
//
// Strategy for captureException: the components import it from the LEAF module
// `@agentic-toolkit/adh/telemetry/report-error` (by package path, not relatively — see
// layout/RouteError.tsx and the matching tsup `external`), so we vi.mock exactly that
// specifier and stub the named export. Mocking the `@agentic-toolkit/adh/telemetry`
// BARREL instead leaves the real leaf in place and every captureException assertion
// below fails — a barrel that re-exports the leaf is a different module. A relative
// '../telemetry/report-error' happens to work today (vi.mock resolves its argument, and
// the active `development` export condition sends both spellings to the same src file),
// but mirroring the subject's specifier is what keeps that true if the exports map or the
// run's conditions change and the subject starts resolving to dist/.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Mocks (must be hoisted before any component imports)
// ---------------------------------------------------------------------------

// Minimal ErrorBoundary shim: wraps children, catches render errors, and
// renders `fallback` (which mirrors what @sentry/react does). AppErrorBoundary
// passes a FUNCTION fallback (the @sentry/react `FallbackRender` form), so the
// shim calls it with the caught error; a plain element is rendered as-is.
vi.mock('@sentry/react', () => {
  const { Component } = require('react') as typeof import('react')
  type Fallback = ReactNode | ((data: { error: unknown }) => ReactNode)

  class ErrorBoundary extends Component<
    { fallback: Fallback; children: ReactNode },
    { hasError: boolean; error: unknown }
  > {
    constructor(props: { fallback: Fallback; children: ReactNode }) {
      super(props)
      this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: unknown) {
      return { hasError: true, error }
    }

    render() {
      if (this.state.hasError) {
        const fb = this.props.fallback
        return typeof fb === 'function' ? fb({ error: this.state.error }) : fb
      }
      return this.props.children
    }
  }

  return { ErrorBoundary }
})

// Stand in for captureException so we can assert it's called with the right context.
// These tests are about what the boundaries report, not about how report-error forwards it
// (src/__tests__/reportError.test.ts covers the real one, which it can import relatively
// because it IS the subject rather than a mocked dependency).
//
// Spread importOriginal() rather than listing the exports this test happens to need: a
// hand-written object silently turns every export it omits into `undefined` for EVERY
// module in this test's graph, so adding an export to the leaf breaks unrelated tests at
// call time, far from the cause. (The leaf already grew `reportUnexpectedError`, which a
// two-key factory here would have dropped.) Overriding exactly one export keeps the rest
// real and keeps this mock correct as the leaf evolves.
const captureExceptionSpy = vi.fn()
vi.mock('@agentic-toolkit/adh/telemetry/report-error', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../telemetry/report-error')>()),
  captureException: (...args: unknown[]) => captureExceptionSpy(...args),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks so vi.mock hoisting applies)
// ---------------------------------------------------------------------------
import { AppErrorBoundary } from '../layout/AppErrorBoundary'
import { RouteError } from '../layout/RouteError'
import { GlobalError } from '../layout/GlobalError'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Child that throws during render — used to trigger the error boundary. */
function Bomb(): never {
  throw new Error('render explosion')
}

beforeEach(() => {
  captureExceptionSpy.mockClear()
  // Suppress the expected React error-boundary console.error noise.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// AppErrorBoundary
// ---------------------------------------------------------------------------

describe('AppErrorBoundary', () => {
  it('passes children through when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeTruthy()
  })

  it('renders the "Something went wrong" fallback when a child crashes', () => {
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('renders a Reload button in the fallback (not "Try again")', () => {
    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// RouteError
// ---------------------------------------------------------------------------

describe('RouteError', () => {
  it('renders the "Something went wrong" fallback text', () => {
    const reset = vi.fn()
    render(<RouteError error={new Error('boom')} reset={reset} />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('calls captureException with boundary:"route-error" on mount', () => {
    const error = new Error('boom')
    render(<RouteError error={error} reset={vi.fn()} />)
    expect(captureExceptionSpy).toHaveBeenCalledOnce()
    expect(captureExceptionSpy).toHaveBeenCalledWith(error, {
      boundary: 'route-error',
      digest: null,
    })
  })

  it('includes digest in the captureException context when present', () => {
    const error = Object.assign(new Error('boom'), { digest: 'abc123' })
    render(<RouteError error={error} reset={vi.fn()} />)
    expect(captureExceptionSpy).toHaveBeenCalledWith(error, {
      boundary: 'route-error',
      digest: 'abc123',
    })
  })

  it('clicking the retry button calls reset', () => {
    const reset = vi.fn()
    render(<RouteError error={new Error('boom')} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('re-reports when the error prop changes', () => {
    const reset = vi.fn()
    const err1 = new Error('first')
    const err2 = new Error('second')
    const { rerender } = render(<RouteError error={err1} reset={reset} />)
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1)
    act(() => {
      rerender(<RouteError error={err2} reset={reset} />)
    })
    expect(captureExceptionSpy).toHaveBeenCalledTimes(2)
    expect(captureExceptionSpy).toHaveBeenLastCalledWith(err2, {
      boundary: 'route-error',
      digest: null,
    })
  })
})

// ---------------------------------------------------------------------------
// GlobalError
// ---------------------------------------------------------------------------

describe('GlobalError', () => {
  it('renders the "Something went wrong" heading', () => {
    const error = Object.assign(new Error('boom'), { digest: 'd1' })
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('calls captureException with boundary:"global-error" on mount', () => {
    const error = Object.assign(new Error('boom'), { digest: 'd1' })
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(captureExceptionSpy).toHaveBeenCalledOnce()
    expect(captureExceptionSpy).toHaveBeenCalledWith(error, {
      boundary: 'global-error',
      digest: 'd1',
    })
  })

  it('includes null digest when no digest on the error', () => {
    const error = new Error('boom')
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(captureExceptionSpy).toHaveBeenCalledWith(error, {
      boundary: 'global-error',
      digest: null,
    })
  })

  it('clicking "Try again" calls reset', () => {
    const reset = vi.fn()
    const error = Object.assign(new Error('boom'), { digest: 'd1' })
    render(<GlobalError error={error} reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
