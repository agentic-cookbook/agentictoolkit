import { describe, expect, it, vi } from 'vitest'
import { reportUnexpectedAuthError } from '../report'
import { AuthHttpError } from '../client'

describe('reportUnexpectedAuthError', () => {
  it('swallows expected 401s silently', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportUnexpectedAuthError(new AuthHttpError(401, 'unauthorized'))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('logs unexpected errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportUnexpectedAuthError(new Error('boom'), { source: 'useResourceList' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
