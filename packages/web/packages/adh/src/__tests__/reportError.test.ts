import { describe, it, expect, vi, beforeEach } from 'vitest'
import { captureException, setErrorReporter } from '../telemetry/report-error'

beforeEach(() => setErrorReporter(null))

describe('captureException', () => {
  it('no-ops (does not throw) when no reporter is registered', () => {
    expect(() => captureException(new Error('x'))).not.toThrow()
  })

  it('routes the error + context to the registered reporter', () => {
    const reporter = vi.fn()
    setErrorReporter(reporter)
    const err = new Error('boom')
    captureException(err, { feature: 'account-linking', provider: 'github' })
    expect(reporter).toHaveBeenCalledWith(err, { feature: 'account-linking', provider: 'github' })
  })

  it('never throws even if the reporter itself throws (telemetry must not break callers)', () => {
    setErrorReporter(() => {
      throw new Error('reporter exploded')
    })
    expect(() => captureException(new Error('x'))).not.toThrow()
  })

  it('setErrorReporter(null) unregisters the reporter', () => {
    const reporter = vi.fn()
    setErrorReporter(reporter)
    setErrorReporter(null)
    captureException(new Error('x'))
    expect(reporter).not.toHaveBeenCalled()
  })
})
