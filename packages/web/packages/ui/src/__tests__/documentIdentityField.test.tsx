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
    const { container } = render(<Harness verdict={{ status: 'idle', reason: null }} />)
    expect(screen.queryByText(/unavailable/i)).toBeNull()
    expect(screen.queryByText(/^available$/i)).toBeNull()
    // The live region itself must already be mounted — with no text — even at idle: an
    // `aria-live` region has to exist in the DOM *before* its content changes for assistive
    // tech to announce the mutation, so the span cannot wait for the first non-idle verdict to
    // appear. This is the assertion that would fail if the span were wrapped back in
    // `{status && (…)}`.
    expect(container.querySelector('[data-slot="slug-status"]')).not.toBeNull()
  })
  it("keeps the slug input's accessible name stable, excluding the verdict", () => {
    // Field layout="inline" wraps its caption AND its children in one <Label>, so a naive
    // reading of the DOM makes the input's accessible name include whatever the verdict
    // span says -- which both mutates the name on every verdict change and duplicates text
    // that is already an aria-live region. aria-labelledby overrides the wrapping label, so
    // the name must stay exactly the caption, reason text and all excluded, even when a
    // reason is present.
    render(<Harness verdict={{ status: 'unavailable', reason: 'That word is reserved.' }} />)
    const slugInput = screen.getByRole('textbox', { name: 'Slug' })
    expect(slugInput).toHaveAccessibleName('Slug')
    // The reason is still on the page (announced via the live region) -- just not IN the name.
    expect(screen.getByText('That word is reserved.')).toBeInTheDocument()
    // ...and it reaches the input as its DESCRIPTION. Without this assertion, dropping
    // aria-describedby leaves the verdict visible but programmatically unattached to the
    // field it is about, and every other test in this file still passes.
    expect(slugInput).toHaveAccessibleDescription('That word is reserved.')
    // The later-task lookup this must keep working.
    expect(screen.getByLabelText(/slug/i)).toBe(slugInput)
  })

  it('pins each verdict to its tone — success green, error red, never the inherited colour', () => {
    // `STATUS_TONE` is a hand-rolled map next to a comment naming exactly this failure mode:
    // both verdicts rendering in the inherited (unstyled) colour while every other test still
    // passes, because none of them look at the CLASS, only the text. Swap the two entries for
    // each other and this is the only assertion that goes red.
    const { unmount: unmountAvailable } = render(
      <Harness verdict={{ status: 'available', reason: null }} />,
    )
    expect(screen.getByText('Available')).toHaveClass('text-apt-green')
    unmountAvailable()

    render(<Harness verdict={{ status: 'unavailable', reason: null }} />)
    expect(screen.getByText('Unavailable')).toHaveClass('text-apt-red')
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
  it('leaves the verdict idle when the checker rejects, rather than surfacing "unavailable"', async () => {
    // Pinning the deliberate choice: a network failure is indistinguishable from "the slug is
    // taken" to the editor, and treating it as "unavailable" would block a save over a problem
    // that has nothing to do with the slug. If the .catch ever started surfacing "unavailable"
    // here, this is the test that would catch it.
    const check = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSlugAvailability('any-slug', check, { debounceMs: 10 }))
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1))
    expect(result.current.status).toBe('idle')
    expect(result.current.reason).toBeNull()
  })

  it('waits the documented 350ms default when no debounceMs is injected', async () => {
    // Every other test in this block passes an explicit `debounceMs: 10` to make itself fast,
    // which means none of them exercise the DEFAULT the hook actually ships with. Pin it here.
    const check = vi.fn().mockResolvedValue({ available: true })
    const { result } = renderHook(() => useSlugAvailability('default-timing-slug', check))
    await act(async () => {
      vi.advanceTimersByTime(349)
    })
    expect(check).not.toHaveBeenCalled()
    expect(result.current.status).toBe('checking')
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    // Assert synchronously, right after crossing the boundary — not through `waitFor`, which
    // (under `shouldAdvanceTime: true`) keeps nudging fake time forward on its own and would
    // therefore pass even if the default debounce were longer than 350ms. Only a synchronous
    // check at exactly the 350ms mark pins the default in both directions.
    expect(check).toHaveBeenCalledTimes(1)
    // The promise resolution that follows is a microtask, not a timer, so waiting it out here
    // is fine — it does not mask the boundary assertion above.
    await waitFor(() => expect(result.current.status).toBe('available'))
  })

  it('re-asks when the SUBJECT changes under an unchanged slug', async () => {
    // The pair, not the string. A verdict is "this slug, for this document": the checker
    // excludes the current document's own route, so "available" for the paper the author just
    // left says nothing about the one they just opened. Keyed on the slug alone, the effect
    // never re-runs across the switch and the stale verdict stands — and the host's Save
    // trusts it into a 409 the author was told would not happen.
    const check = vi.fn().mockResolvedValue({ available: true })
    const { result, rerender } = renderHook(
      ({ subject }: { subject: string }) =>
        useSlugAvailability('shared-slug', check, { debounceMs: 10, subject }),
      { initialProps: { subject: 'doc-a' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    await waitFor(() => expect(result.current.status).toBe('available'))
    expect(check).toHaveBeenCalledTimes(1)

    check.mockResolvedValue({ available: false, reason: 'taken' })
    rerender({ subject: 'doc-b' })
    // Not merely re-asked: the answer on screen while the new one is in flight must not be
    // the old document's.
    expect(result.current.status).toBe('checking')
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('drops an answer that arrives after the subject moved on', async () => {
    // The same out-of-order guard as the slug's, on the other half of the pair: a slow
    // "unavailable" for the document the author already left must not land on this one.
    let resolveFirst: (v: { available: boolean }) => void = () => {}
    const check = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValue({ available: true })

    const { result, rerender } = renderHook(
      ({ subject }: { subject: string }) =>
        useSlugAvailability('shared-slug', check, { debounceMs: 10, subject }),
      { initialProps: { subject: 'doc-a' } },
    )
    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    rerender({ subject: 'doc-b' })
    await act(async () => {
      vi.advanceTimersByTime(50)
      resolveFirst({ available: false })
    })
    await waitFor(() => expect(result.current.status).toBe('available'))
  })

})
