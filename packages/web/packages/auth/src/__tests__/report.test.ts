import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportUnexpectedAuthError, setAuthErrorReporter } from '../report'
import { AuthHttpError } from '../client'

// Stand-in for a HOST's own AuthHttpError class layered atop this package's: a
// DISTINCT constructor carrying the same numeric `.status`. The duck-typed gate
// must treat it identically to this package's own AuthHttpError, so a host that
// layers its own auth client atop this package doesn't leak expected 4xx noise.
class HostAuthHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HostAuthHttpError'
  }
}

afterEach(() => {
  setAuthErrorReporter(null)
  vi.restoreAllMocks()
})

describe('reportUnexpectedAuthError', () => {
  it('drops an expected 4xx from EITHER AuthHttpError class', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sink = vi.fn()
    setAuthErrorReporter(sink)
    reportUnexpectedAuthError(new AuthHttpError(401, 'unauthorized'))
    reportUnexpectedAuthError(new HostAuthHttpError(403, 'forbidden'))
    expect(spy).not.toHaveBeenCalled()
    expect(sink).not.toHaveBeenCalled()
  })

  it('reports a 5xx (a backend failure, not an expected client error)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sink = vi.fn()
    setAuthErrorReporter(sink)
    reportUnexpectedAuthError(new AuthHttpError(503, 'unavailable'))
    expect(spy).toHaveBeenCalled()
    expect(sink).toHaveBeenCalled()
  })

  it('reports a non-HTTP error (e.g. a dropped network request)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportUnexpectedAuthError(new Error('boom'), { source: 'useResourceList' })
    expect(spy).toHaveBeenCalled()
  })

  it('passes the error AND context to the injected sink', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const sink = vi.fn()
    setAuthErrorReporter(sink)
    const err = new Error('boom')
    reportUnexpectedAuthError(err, { feature: 'x', step: 'load' })
    expect(sink).toHaveBeenCalledWith(err, { feature: 'x', step: 'load' })
  })

  it('swallows a throwing sink so the caller never breaks (and still logs)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setAuthErrorReporter(() => {
      throw new Error('telemetry down')
    })
    expect(() => reportUnexpectedAuthError(new Error('boom'))).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })
})
