import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { RouteProvider, useCurrentRoute } from '../RouteProvider'

describe('RouteProvider', () => {
  it('exposes pathname/hash and a navigate fn', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: ({ children }) => (
        <RouteProvider pathname="/g/a" hash="#x" navigate={navigate}>
          {children}
        </RouteProvider>
      ),
    })
    expect(result.current.pathname).toBe('/g/a')
    expect(result.current.hash).toBe('#x')
    act(() => result.current.navigate('/elsewhere'))
    expect(navigate).toHaveBeenCalledWith('/elsewhere')
  })

  it('falls back to defaults when no provider', () => {
    const { result } = renderHook(() => useCurrentRoute())
    expect(result.current.pathname).toBe('/')
    expect(result.current.hash).toBe('')
    expect(typeof result.current.navigate).toBe('function')
  })
})
