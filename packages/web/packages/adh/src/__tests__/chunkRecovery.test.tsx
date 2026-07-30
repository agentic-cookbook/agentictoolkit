// Tests for the stale-deployment chunk-recovery helper and its wiring into the
// RouteError / GlobalError boundaries. `window.location.reload` is not implemented
// in jsdom, so we replace `window.location` with a stub exposing a spy.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  isChunkLoadError,
  recoverFromChunkError,
  CHUNK_UPDATE_COPY,
} from '../layout/chunk-recovery'
import { RouteError } from '../layout/RouteError'
import { GlobalError } from '../layout/GlobalError'

/** A realistic stale-deploy ChunkLoadError (matches GlitchTip issue ADH-J). */
function chunkError(): Error {
  return Object.assign(
    new Error('Failed to load chunk /_next/static/chunks/abc.css?dpl=dpl_x from module 95630'),
    { name: 'ChunkLoadError' },
  )
}

const reload = vi.fn()

beforeEach(() => {
  reload.mockClear()
  window.sessionStorage.clear()
  Object.defineProperty(window, 'location', { configurable: true, value: { reload } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isChunkLoadError', () => {
  it('matches by error name', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
  })

  it.each([
    'Loading chunk 42 failed',
    'Loading CSS chunk 7 failed',
    'Failed to load chunk /_next/static/chunks/x.js',
  ])('matches by message: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true)
  })

  it('is false for an ordinary error', () => {
    expect(isChunkLoadError(new Error('render explosion'))).toBe(false)
  })

  it.each([
    'Failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'Importing a module script failed',
  ])('is false for offline dynamic-import error (reload would not help): %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(false)
  })

  it.each([null, undefined, 'a string', 42])('is false for non-error %s', (value) => {
    expect(isChunkLoadError(value)).toBe(false)
  })
})

describe('recoverFromChunkError', () => {
  it('reloads once for a chunk error and returns true', () => {
    expect(recoverFromChunkError(chunkError())).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload for a non-chunk error', () => {
    expect(recoverFromChunkError(new Error('boom'))).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload twice within the cooldown window (loop guard)', () => {
    expect(recoverFromChunkError(chunkError())).toBe(true)
    expect(recoverFromChunkError(chunkError())).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('declines to auto-reload when sessionStorage is unavailable (loop-safe)', () => {
    // Without persistent storage the cooldown can't survive a reload, so an
    // unconditional reload would loop forever — fail safe to no reload instead.
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(recoverFromChunkError(chunkError())).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('RouteError chunk path', () => {
  it('shows the non-alarming update copy and triggers a reload', () => {
    render(<RouteError error={chunkError()} reset={vi.fn()} />)
    expect(screen.getByText(CHUNK_UPDATE_COPY.title)).toBeTruthy()
    expect(screen.queryByText('Something went wrong')).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })
})

describe('GlobalError chunk path', () => {
  it('shows the non-alarming update copy and triggers a reload', () => {
    render(<GlobalError error={chunkError()} reset={vi.fn()} />)
    expect(screen.getByText(CHUNK_UPDATE_COPY.title)).toBeTruthy()
    expect(screen.queryByText('Something went wrong')).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
  })
})
