/**
 * DocumentIdentityField — what a document is called, and where it lives.
 *
 * The behaviour worth pinning is the FOLLOW rule, because it is the one a user notices when
 * it is wrong in either direction: a slug that stops tracking the title too early makes the
 * default useless, and one that never stops overwrites the unique slug the author just typed
 * to resolve a collision. Both directions are asserted.
 *
 * The verdict is passed IN rather than owned here — Save has to consult the same answer, so
 * the hook that produces it is tested separately below against a controllable checker.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'

import {
  DocumentIdentityField,
  useSlugAvailability,
  type SlugVerdict,
} from '../blocks/document-identity-field'

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function Harness({ verdict }: { verdict?: SlugVerdict }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  return (
    <DocumentIdentityField
      title={title}
      onTitleChange={setTitle}
      slug={slug}
      onSlugChange={setSlug}
      slugify={slugify}
      verdict={verdict}
    />
  )
}

function type(el: HTMLElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(cleanup)

describe('DocumentIdentityField', () => {
  it('derives the slug from the title while the slug is untouched', () => {
    render(<Harness />)
    act(() => type(screen.getByLabelText(/title/i), 'Intelligence At The Edges'))
    expect(screen.getByLabelText(/slug/i)).toHaveValue('intelligence-at-the-edges')
  })

  it('stops following once the author edits the slug themselves', () => {
    render(<Harness />)
    act(() => type(screen.getByLabelText(/title/i), 'Hello World'))
    act(() => type(screen.getByLabelText(/slug/i), 'hello-world-2'))
    act(() => type(screen.getByLabelText(/title/i), 'Hello World Again'))
    expect(screen.getByLabelText(/slug/i)).toHaveValue('hello-world-2')
    expect(screen.getByLabelText(/title/i)).toHaveValue('Hello World Again')
  })

  it('says a slug is available', () => {
    render(<Harness verdict={{ status: 'available', reason: null }} />)
    expect(screen.getByText(/available/i)).toBeInTheDocument()
  })

  it('says a slug is unavailable, with the reason when there is one', () => {
    render(<Harness verdict={{ status: 'unavailable', reason: 'That word is reserved.' }} />)
    expect(screen.getByText('That word is reserved.')).toBeInTheDocument()
  })

  it('says nothing at all before anything has been checked', () => {
    render(<Harness verdict={{ status: 'idle', reason: null }} />)
    expect(screen.queryByText(/unavailable/i)).toBeNull()
    expect(screen.queryByText(/^available$/i)).toBeNull()
  })
})

describe('useSlugAvailability', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('is idle with no slug and never asks', async () => {
    const check = vi.fn()
    const { result } = renderHook(() => useSlugAvailability('', check, { debounceMs: 10 }))
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current.status).toBe('idle')
    expect(check).not.toHaveBeenCalled()
  })

  it('asks once the typing settles and reports the verdict', async () => {
    const check = vi.fn().mockResolvedValue({ available: true })
    const { result } = renderHook(() => useSlugAvailability('free-slug', check, { debounceMs: 10 }))
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    await waitFor(() => expect(result.current.status).toBe('available'))
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('carries the reason through on a refusal', async () => {
    const check = vi.fn().mockResolvedValue({ available: false, reason: 'taken' })
    const { result } = renderHook(() => useSlugAvailability('dupe', check, { debounceMs: 10 }))
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.reason).toBe('taken')
  })

  it('ignores an answer that arrives after the slug moved on', async () => {
    // The out-of-order guard. Without it, a slow "unavailable" for a slug the author has
    // already replaced lands on the NEW slug and blocks a save that should succeed.
    let resolveFirst: (v: { available: boolean }) => void = () => {}
    const check = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValue({ available: true })

    const { result, rerender } = renderHook(
      ({ slug }: { slug: string }) => useSlugAvailability(slug, check, { debounceMs: 10 }),
      { initialProps: { slug: 'first' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    rerender({ slug: 'second' })
    await act(async () => {
      vi.advanceTimersByTime(50)
      resolveFirst({ available: false })
    })
    await waitFor(() => expect(result.current.status).toBe('available'))
  })

  it('is idle when no checker is supplied — the control still renders', async () => {
    const { result } = renderHook(() => useSlugAvailability('anything', undefined, { debounceMs: 10 }))
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current.status).toBe('idle')
  })

  it('does not loop when the host passes a freshly-created checker on every render', async () => {
    // Regression test for the identity-churn infinite-loop bug: a host naturally writes
    // `check={(s) => api.routeAvailable(id, s)}`, a NEW function every render. If the effect
    // depends on `check` itself, the first `setVerdict({status:"checking"})` at the top of the
    // effect body is a brand-new object every run, so React never bails out — render, effect,
    // setState, render, new arrow identity, effect, setState, forever. The hook must depend on
    // the checker's PRESENCE, not its identity, and read the latest one through a ref instead.
    const check = vi.fn().mockResolvedValue({ available: true })
    const { result } = renderHook(
      ({ slug }: { slug: string }) =>
        // A fresh arrow closure is constructed on every render of this wrapper — including the
        // internal re-renders the hook triggers itself via setVerdict.
        useSlugAvailability(slug, (s) => check(s), { debounceMs: 10 }),
      { initialProps: { slug: 'stable-slug' } },
    )

    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    await waitFor(() => expect(result.current.status).toBe('available'))

    // Let any further (buggy) cascade have every remaining chance to fire before asserting.
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.status).toBe('available')
    expect(check).toHaveBeenCalledTimes(1)
  })
})
