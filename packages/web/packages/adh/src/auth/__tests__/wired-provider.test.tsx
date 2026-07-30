import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// vi.mock factories run during the hoisted import graph's resolution — before this file's
// OWN top-level statements execute — so a plain `const x = vi.fn()` referenced inside a
// factory throws "Cannot access 'x' before initialization" (TDZ). vi.hoisted() is the
// vitest-blessed escape hatch: it hoists this whole declaration above every vi.mock call
// below, so the same spy instances are safely visible both inside the factories and in the
// assertions (referential identity is the point of this test).
const { setAuthErrorReporter, setAuthRetryMarker, captureException, markRetriedRequest } = vi.hoisted(() => ({
  setAuthErrorReporter: vi.fn(),
  setAuthRetryMarker: vi.fn(),
  captureException: vi.fn(),
  markRetriedRequest: vi.fn(),
}))

vi.mock('@agentic-toolkit/auth', () => ({
  AuthProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  setAuthErrorReporter,
  setAuthRetryMarker,
  useAuth: () => ({ user: null, tokens: null }),
}))

// Mock the specifier the subject actually writes — the PACKAGE PATH (Amendment G), not a
// relative one. Under vitest today a relative '../../telemetry/report-error' would in fact
// work: vi.mock RESOLVES its argument, the `development` export condition is active in
// serve mode, and both specifiers land on the same src/telemetry/report-error.ts. Mirroring
// the subject is what makes that a guarantee rather than a coincidence — if this package's
// exports map ever drops `development` (or the run goes production-conditioned), the subject
// resolves to dist/ and a src-relative mock would silently stop intercepting, leaving both
// assertions below failing against a correct implementation.
vi.mock('@agentic-toolkit/adh/telemetry/report-error', () => ({ captureException }))
vi.mock('@agentic-toolkit/adh/telemetry/retry', () => ({ markRetriedRequest }))

import { AuthProvider } from '../wired-provider'

describe('AuthProvider (telemetry-wired)', () => {
  it('registers the adh telemetry hooks into the toolkit auth seams on mount', () => {
    render(<AuthProvider clientId="adh">child</AuthProvider>)
    expect(setAuthErrorReporter).toHaveBeenCalledWith(captureException)
    expect(setAuthRetryMarker).toHaveBeenCalledWith(markRetriedRequest)
  })

  it('renders its children', () => {
    const { container } = render(<AuthProvider clientId="adh">hello</AuthProvider>)
    expect(container.textContent).toContain('hello')
  })
})
