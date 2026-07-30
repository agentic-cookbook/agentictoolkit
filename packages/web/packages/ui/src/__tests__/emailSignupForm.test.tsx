/** Unit tests for EmailSignupForm — the embeddable waitlist form marketing sites drop in.
 *
 *  The form has six mutually exclusive outcomes (loading, ready, submitting, done, closed,
 *  unavailable) plus two failure kinds, and the whole point of these tests is that they are
 *  told APART. Every state assertion here runs in BOTH directions: the success path proves the
 *  error affordance is gone, the error path proves the success copy is gone, and the two dead
 *  ends prove they are not each other. A test that only asserts "something rendered" passes in
 *  four of those states at once and pins nothing.
 *
 *  Fixture values are deliberately decorrelated — the list's own copy, the prop overrides, the
 *  nonce and the public key are all distinct strings, so no getByText can match two of them. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CONFIG_TIMEOUT_MS, EmailSignupForm, signupSourceUrl } from '../components/email-signup-form'

const fetchMock = vi.fn()

/**
 * The component's only developer-facing signal, captured rather than printed. Silencing it is a
 * deliberate trade: several tests here drive the failure paths on purpose, and their console
 * output would otherwise bury a real one. The tests that care about the log assert its CONTENT
 * off this spy, which is stronger than reading it in the terminal.
 */
// Typed off the call, not off `vi.spyOn` itself: a bare `ReturnType<typeof vi.spyOn>` leaves the
// generics unresolved, so `.mock.calls` degrades to an untyped array and every callback that
// reads one is an implicit any — which `tsc --noEmit` rejects, taking the package's lint with it.
const silenceConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => {})
let consoleError: ReturnType<typeof silenceConsoleError>

/** The body every green config GET in this file returns. */
const OPEN_CONFIG = { name: 'Launch list', description: 'Be first to know.', status: 'open', nonce: 'n1' }
const configOk = (body: Record<string, unknown> = OPEN_CONFIG) => ({ ok: true, json: async () => body })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  consoleError = silenceConsoleError()
  // The mount GET that fetches display config + the nonce.
  fetchMock.mockResolvedValueOnce(configOk())
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Restores the console spy AND any `AbortSignal.timeout` spy a test installed, so a failure
  // mid-test cannot leak a shortened deadline into the rest of the file.
  vi.restoreAllMocks()
})

const setup = () => render(<EmailSignupForm publicKey="pk1" apiBaseUrl="https://api.test" />)

// `fireEvent.change` on a controlled input sets the value in one shot, so unlike
// user-event's per-keystroke typing there is nothing to await between the change and
// the submit.
const typeEmail = (value: string) =>
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value } })

// Submit through the FORM, not the button: `fireEvent.click` on a submit button does not
// fire the form's submit handler in jsdom.
const submitForm = () => fireEvent.submit(screen.getByRole('button', { name: /sign up/i }).closest('form')!)

const okPost = () => ({ ok: true, json: async () => ({ ok: true }) })

/**
 * Reach a recorded fetch call. Under `noUncheckedIndexedAccess` an index into `mock.calls` is
 * possibly-undefined, so this asserts the call actually happened before handing it back — which
 * turns "the form never called fetch at all" from a confusing destructuring crash into a plain
 * failed expectation.
 */
type FetchCall = [url: string, init: { method?: string; body: string; signal?: AbortSignal }]
const callAt = (index: number): FetchCall => {
  const call = fetchMock.mock.calls[index]
  expect(call, `expected a fetch call at index ${index}`).toBeDefined()
  return call as FetchCall
}

describe('EmailSignupForm', () => {
  it('renders the list copy it fetched, with neither outcome affordance showing', async () => {
    setup()

    expect(await screen.findByText('Launch list')).toBeInTheDocument()
    expect(screen.getByText('Be first to know.')).toBeInTheDocument()

    // Idle is not success and not failure. Without these the "renders" assertion above would
    // also pass while an error sat on screen.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
  })

  it('submits the address with the nonce it was issued', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = callAt(1)
    expect(url).toBe('https://api.test/public/signup-lists/pk1/signups')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      email: 'ada@example.com',
      nonce: 'n1',
      // Sent EMPTY by a real user. The server drops any submission where this has a value.
      website: '',
    })
  })

  it('fetches the list config from the public GET endpoint', async () => {
    setup()
    await screen.findByText('Launch list')

    expect(callAt(0)[0]).toBe('https://api.test/public/signup-lists/pk1')
  })

  // The honeypot is only a defence if it is unreachable by a human: visible to the DOM,
  // invisible to eyes, screen readers, and the tab key.
  it('renders the honeypot out of reach', async () => {
    setup()
    await screen.findByText('Launch list')
    const pot = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(pot).not.toBeNull()
    expect(pot.tabIndex).toBe(-1)
    expect(pot.getAttribute('aria-hidden')).toBe('true')
    expect(pot.getAttribute('autocomplete')).toBe('off')
  })

  /**
   * The honeypot's ONLY load-bearing behaviour, and the one the rest of the suite could not see.
   *
   * The defence is split across two repos: the server drops any submission whose `website` has a
   * value (publicSignup.ts — uniform `200 {ok:true}`, nothing written), and this component is the
   * only thing in existence that can ever put a value there. `website: ''` — what the
   * "submits the address with the nonce it was issued" case asserts — is exactly what a form with
   * the honeypot ripped out sends, so that assertion is satisfied identically by the working and
   * the gutted implementation. This one is not: it fills the field a bot would fill and pins the
   * value onto the wire.
   *
   * The backend's own honeypot int tests POST the field directly, so they stay green forever
   * whatever this component does. This test is the only link in the chain.
   */
  it('forwards what was typed into the honeypot, which is the only thing that arms the filter', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    const pot = document.querySelector('input[name="website"]') as HTMLInputElement
    fireEvent.change(pot, { target: { value: 'https://bot.example/spam' } })
    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const body = JSON.parse(callAt(1)[1].body)
    expect(body.website).toBe('https://bot.example/spam')
    // Decorrelated: the honeypot value shares no substring with anything else on the wire, and
    // the real fields are asserted alongside it so a body that dropped everything cannot pass.
    expect(body.email).toBe('ada@example.com')
    expect(body.nonce).toBe('n1')
  })

  it('shows a success message and hides the form after submitting', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    typeEmail('ada@example.com')
    submitForm()

    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    // Success is not "success plus a leftover error". This is the assertion that stops the
    // test passing in the error state too.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('moves focus to the success message so it is announced', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    typeEmail('ada@example.com')
    submitForm()

    // A live region mounted at the same instant as its content is routinely missed by screen
    // readers; taking focus is what makes the outcome reach the visitor.
    const status = await screen.findByRole('status')
    expect(status).toHaveFocus()
  })

  it('marks the button busy while in flight, then flips it to the success state', async () => {
    setup()
    await screen.findByText('Launch list')

    let settle!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    const idleButton = screen.getByRole('button', { name: /sign up/i })
    expect(idleButton).toBeEnabled()
    expect(idleButton).toHaveAttribute('aria-busy', 'false')

    typeEmail('ada@example.com')
    submitForm()

    // In flight: perceivable as busy, and NOT yet either outcome.
    const busyButton = await screen.findByRole('button', { name: /signing up/i })
    expect(busyButton).toBeDisabled()
    expect(busyButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await act(async () => {
      settle(okPost())
    })

    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /signing up/i })).not.toBeInTheDocument()
  })

  it('surfaces a server error without losing what was typed', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'invalid submission' }) })

    typeEmail('ada@example.com')
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(screen.getByLabelText(/email/i)).toHaveValue('ada@example.com')
    // Failure is not success. Without this the test would still pass if the form had ALSO
    // declared victory, which is exactly the bug the generic-error branch could introduce.
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // A request failure is not the visitor's typo — the field must not be marked invalid.
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'false')
  })

  // Re-enabling the button is only half of "the visitor can retry": the nonce the mount GET
  // issued expires server-side (audience/nonce.ts MAX_AGE_MS, 30 minutes), so a form that kept
  // its original config would re-send the identical dead value on every attempt and the tab
  // could NEVER sign up again. This retries for real and pins WHICH nonce the second POST
  // carried — asserting only that the button came back would stay green under that bug.
  it('re-enables the button after a server error, and the retry carries a FRESH nonce', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    // The refresh GET the failure must trigger, handing back a different nonce.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Launch list', description: 'Be first to know.', status: 'open', nonce: 'n2' }),
    })

    typeEmail('ada@example.com')
    submitForm()

    await screen.findByRole('alert')
    const button = screen.getByRole('button', { name: /sign up/i })
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-busy', 'false')

    // GET, failed POST, refresh GET — and the refresh must address the same public list.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(callAt(2)[0]).toBe('https://api.test/public/signup-lists/pk1')

    fetchMock.mockResolvedValueOnce(okPost())
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    const retried = JSON.parse(callAt(3)[1].body)
    expect(retried.nonce).toBe('n2')
    expect(retried.email).toBe('ada@example.com')
    // The retry SUCCEEDS: success copy present, and the first attempt's error gone with it.
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // The refresh is a best-effort repair, not a new failure mode: if it cannot reach the server
  // the visitor must still be looking at a usable form, not an error page or a dead button.
  it('keeps the form usable when the post-failure config refresh ALSO fails', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    fetchMock.mockRejectedValueOnce(new Error('still offline'))

    typeEmail('ada@example.com')
    submitForm()

    await screen.findByRole('alert')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(screen.getByRole('button', { name: /sign up/i })).toBeEnabled()
    expect(screen.getByLabelText(/email/i)).toHaveValue('ada@example.com')
    // Not the two dead ends — a transient blip must not claim the list is closed or gone.
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/is closed to new signups/i)).not.toBeInTheDocument()
  })

  // ...but a list that CLOSED while the tab sat open is a durable answer, and the refresh is
  // where the form finds out. Continuing to offer a form that can only be rejected is the lie
  // this pins against.
  it('stops offering the form when the refresh reports the list has since closed', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Launch list', description: null, status: 'closed', nonce: 'n2' }),
    })

    typeEmail('ada@example.com')
    submitForm()

    expect(await screen.findByText(/is closed to new signups/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
  })

  it('rejects a malformed address itself instead of spending a signup on it', async () => {
    setup()
    await screen.findByText('Launch list')

    typeEmail('ada-at-example.com')
    submitForm()

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email address/i)
    // The mount GET and nothing else: the server's ten-per-hour cap is not burned on a typo.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Validation is told apart from a request failure by WHERE it points.
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toHaveTextContent(/something went wrong/i)
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
  })

  /**
   * Asserted DURING the in-flight submit, not after it.
   *
   * The previous version of this test checked `queryByRole('alert')` once the POST had succeeded
   * — but success unmounts the whole form and renders SignupDone, so there is no alert to find
   * whether or not the error was ever cleared. Deleting `setError(null)` from `submit()` left it
   * green. The window that matters is the one the visitor actually sees on a slow connection:
   * they fixed the typo, the request is in flight, and the stale "Enter a valid email address."
   * plus `aria-invalid="true"` would sit there for the whole round trip.
   */
  it('clears the validation error the moment a good address is submitted, not when it succeeds', async () => {
    setup()
    await screen.findByText('Launch list')

    typeEmail('ada-at-example.com')
    submitForm()
    await screen.findByRole('alert')

    // A POST held open on purpose, so the assertions below run while the form is still mounted.
    let settle!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    typeEmail('ada@example.com')
    submitForm()

    // In flight — the form is on screen, so an uncleared error would be too.
    expect(await screen.findByRole('button', { name: /signing up/i })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'false')

    // ...and it still ends where the old test ended, so this replaces that coverage rather than
    // trading it away.
    await act(async () => {
      settle(okPost())
    })
    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Minor 3: the association that makes the message reachable FROM the field. `aria-invalid` was
  // asserted in both directions already; the link never was, so a field that announced "invalid"
  // and nothing else would have passed.
  it('points the email field at the validation message it caused', async () => {
    setup()
    await screen.findByText('Launch list')

    typeEmail('ada-at-example.com')
    submitForm()

    const alert = await screen.findByRole('alert')
    expect(alert.id).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-describedby', alert.id)
  })

  // The other direction, which is what stops the assertion above from being satisfied by an
  // unconditional `aria-describedby`: a REQUEST failure is not the visitor's typo, so it must not
  // be described onto the field. The two error kinds are told apart by what they point AT.
  it('does not describe the field with an error that is not about the field', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    fetchMock.mockResolvedValueOnce(configOk())

    typeEmail('ada@example.com')
    submitForm()

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute('aria-describedby')
  })

  // Minor 3: both call sites encode, and both were previously exercised with `pk1`, which encodes
  // to itself — so the encoding was unobserved. This key contains the three characters that
  // change meaning inside a path: a separator, a space, and a query delimiter.
  it('percent-encodes the public key in both endpoints it addresses', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce(configOk())
    render(<EmailSignupForm publicKey="pk/1 2&3" apiBaseUrl="https://api.test" />)
    await screen.findByText('Launch list')

    expect(callAt(0)[0]).toBe('https://api.test/public/signup-lists/pk%2F1%202%263')

    fetchMock.mockResolvedValueOnce(okPost())
    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(callAt(1)[0]).toBe('https://api.test/public/signup-lists/pk%2F1%202%263/signups')
  })

  // Minor 3: the attribution field the backend stores as `consent_source_url` — the evidence that
  // this address opted in on THIS page. Nothing asserted it was sent at all.
  it('sends the page the signup came from, which becomes the consent record provenance', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const body = JSON.parse(callAt(1)[1].body)
    expect(body.sourceUrl).toBe(window.location.href)
    // Decorrelation: `window.location.href` is a real absolute URL, not the empty string a
    // dropped field would compare equal to if the expectation were written loosely.
    expect(body.sourceUrl).toMatch(/^https?:\/\/.+/)
  })

  it('says so when the list is closed instead of offering a form', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Launch list', description: null, status: 'closed', nonce: 'n1' }),
    })
    setup()

    expect(await screen.findByText(/closed/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // A list that is closed and an API that never answered are different facts. Collapsing them
  // would have the form assert, on someone else's marketing page, that a perfectly open list
  // is closed whenever the backend is down.
  it('does not claim the list is closed when the config request fails', async () => {
    fetchMock.mockReset()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    setup()

    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/closed/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('treats a non-ok config response as unavailable, not as a form', async () => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    setup()

    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument()
  })

  /**
   * `unavailable` used to be a one-way door — six `setPhase` call sites and not one of them left
   * it, with a mount effect whose deps were two stable callbacks, so nothing could re-enter it.
   * The copy said "try again later" while offering nothing to try; the only cure was a full page
   * reload, which the copy never mentioned.
   *
   * And it is the state EVERY embed starts in: the backend gates the public endpoints on an
   * ecosystem flag that is fail-closed with no seed migration, and deliberately answers 404 for
   * "feature off" so a disabled feature is not detectable. So until an operator flips that flag,
   * every visitor to every embed sees this state — and when they do flip it, the mounted forms
   * on every page have to recover on their own or the fix is invisible.
   */
  describe('the unavailable dead end', () => {
    it('recovers on the visitor’s own retry, with no page reload', async () => {
      fetchMock.mockReset()
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      setup()
      await screen.findByText(/unavailable/i)

      // Held open so the in-flight moment is observable.
      let settle!: (value: unknown) => void
      fetchMock.mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve
        }),
      )
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      // The click is acknowledged straight away: the failure copy gives way rather than sitting
      // there looking like the button did nothing for the length of the round trip.
      expect(await screen.findByText(/^loading…$/i)).toBeInTheDocument()
      expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()

      await act(async () => {
        settle(configOk())
      })

      // The form the visitor came for, from a component that was already mounted.
      expect(await screen.findByText('Launch list')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      // ...and the dead end is gone, not merely covered up.
      expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    // A retry that itself fails must leave the visitor where they can retry AGAIN. A one-shot
    // control is the same dead end one click further along.
    it('keeps offering the retry when the retry itself fails', async () => {
      fetchMock.mockReset()
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      setup()
      await screen.findByText(/unavailable/i)

      fetchMock.mockRejectedValueOnce(new Error('still offline'))
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
      // Not stuck mid-retry either: `loading` has no affordance at all, so landing there
      // permanently would be a worse dead end than the one being fixed.
      expect(screen.queryByText(/^loading…$/i)).not.toBeInTheDocument()

      // And the third attempt still works — nothing about the failed retry latched.
      fetchMock.mockResolvedValueOnce(configOk())
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(await screen.findByLabelText(/email/i)).toBeInTheDocument()
    })

    /**
     * The site owner's half of the problem. A 404 (key typo'd, or the ecosystem flag off), a 500
     * and a network drop are one indistinguishable sentence on the page — by design, since the
     * visitor-facing copy must not narrate the backend. That left the OWNER with a page that
     * looks fine and an empty console: the file had no logging of any kind, and `fetchConfig`
     * threw the status into a bare `catch {}`.
     */
    it('logs the public key and the status so a mis-pasted key is diagnosable', async () => {
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      render(<EmailSignupForm publicKey="pk_typo_9z" apiBaseUrl="https://api.test" />)
      await screen.findByText(/unavailable/i)

      const logged = consoleError.mock.calls.map((call) => String(call[0])).join('\n')
      // WHICH embed (a page may carry several) and WHY — the two facts a bare "failed" omits.
      expect(logged).toContain('pk_typo_9z')
      expect(logged).toContain('404')

      // ...and none of it reaches the visitor, who is not the audience for a status code.
      expect(screen.queryByText(/404/)).not.toBeInTheDocument()
      expect(screen.queryByText(/pk_typo_9z/)).not.toBeInTheDocument()
    })

    // A silent refresh failure is the same invisibility one step later: the visitor keeps a form
    // whose nonce may already be dead, and every retry then fails for a reason nothing on the
    // page explains. The VISITOR-facing silence is deliberate and stays (asserted below); the
    // developer-facing silence is the bug.
    it('logs a failed nonce refresh without taking the form away from the visitor', async () => {
      setup()
      await screen.findByText('Launch list')
      fetchMock.mockRejectedValueOnce(new Error('offline'))
      fetchMock.mockRejectedValueOnce(new Error('refresh failed too'))

      typeEmail('ada@example.com')
      submitForm()

      await screen.findByRole('alert')
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
      await waitFor(() =>
        expect(consoleError.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
          'refresh failed too',
        ),
      )
      expect(screen.getByRole('button', { name: /sign up/i })).toBeEnabled()
      expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    })

    /**
     * The third dead end, and the worst of the three: `loading` renders one line of text with no
     * control at all, so a backend that accepts the connection and never answers pins the form
     * there forever on someone else's marketing page. There was no AbortController, no
     * AbortSignal, no timeout guard of any kind.
     *
     * The deadline is real (10s), which is far too long to sit through, so the production value
     * is asserted off the spy and the BEHAVIOUR is driven with a short one. The fetch mock hangs
     * whenever it is handed no signal — which is precisely how the unfixed component calls it —
     * so removing the `signal` leaves this test waiting on a form stuck at `Loading…`.
     */
    it('abandons a hung config GET at its deadline instead of hanging on Loading forever', async () => {
      const realTimeout = AbortSignal.timeout.bind(AbortSignal)
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(20))

      fetchMock.mockReset()
      fetchMock.mockImplementationOnce(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      )
      setup()

      expect(await screen.findByText(/^loading…$/i)).toBeInTheDocument()

      // The deadline fires, the request is abandoned, and the visitor gets somewhere to go.
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.queryByText(/^loading…$/i)).not.toBeInTheDocument()

      // The production deadline, not the one this test shortened it to.
      expect(timeoutSpy).toHaveBeenCalledWith(CONFIG_TIMEOUT_MS)
      expect(CONFIG_TIMEOUT_MS).toBeGreaterThan(1000)
    })
  })

  it('prefers the caller copy over the list copy, replacing it rather than adding to it', async () => {
    render(
      <EmailSignupForm
        publicKey="pk1"
        apiBaseUrl="https://api.test"
        title="Join the beta"
        description="Ships in October."
        buttonLabel="Count me in"
      />,
    )

    expect(await screen.findByText('Join the beta')).toBeInTheDocument()
    expect(screen.getByText('Ships in October.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Count me in' })).toBeInTheDocument()
    // Overriding means REPLACING. Without these the props could be additive and pass.
    expect(screen.queryByText('Launch list')).not.toBeInTheDocument()
    expect(screen.queryByText('Be first to know.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sign up$/i })).not.toBeInTheDocument()
  })

  it('drops the name field when collectName is false, keeping the address field', async () => {
    render(<EmailSignupForm publicKey="pk1" apiBaseUrl="https://api.test" collectName={false} />)
    await screen.findByText('Launch list')

    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('sends the name when one is collected', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada Lovelace' } })
    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(callAt(1)[1].body).name).toBe('Ada Lovelace')
  })

  // Split from the case above, which claimed both halves and only ever exercised the first.
  // The KEY must be absent, not merely falsy: `name: name.trim()` (dropping the `|| undefined`)
  // sends `""`, the server schema has no `.min(1)`, and the contact is stored with an empty
  // name that overwrites whatever the address was previously known by.
  it('omits the name key entirely when the field is left blank', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    // Typed and then cleared, so this pins "blank at submit time" rather than "never touched".
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '  ' } })
    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const body = JSON.parse(callAt(1)[1].body)
    expect('name' in body).toBe(false)
    // Decorrelation: the assertion above would also pass on an empty body.
    expect(body.email).toBe('ada@example.com')
    expect(body.nonce).toBe('n1')
  })

  it('shows the caller success message rather than the default one', async () => {
    render(
      <EmailSignupForm publicKey="pk1" apiBaseUrl="https://api.test" successMessage="You are on the list." />,
    )
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    typeEmail('ada@example.com')
    submitForm()

    expect(await screen.findByText('You are on the list.')).toBeInTheDocument()
    expect(screen.queryByText(/thanks/i)).not.toBeInTheDocument()
  })

  it('tolerates a trailing slash on the base url without doubling it', async () => {
    render(<EmailSignupForm publicKey="pk1" apiBaseUrl="https://api.test/" />)
    await screen.findByText('Launch list')

    expect(callAt(0)[0]).toBe('https://api.test/public/signup-lists/pk1')
  })

  /**
   * The server refuses any nonce younger than its floor (audience/nonce.ts MIN_AGE_MS) — the
   * "no human filled this form in that fast" check. Refreshing the config after a failed submit
   * mints a FRESH nonce, which restarts that clock: a visitor who clicks again straight away is
   * refused, mints another nonce, and loops forever, each attempt failing for the same reason.
   *
   * Every assertion below is about WHEN the POST leaves, so each one is written to be false if
   * the wait is removed: the "held" checks run in the same synchronous tick as the submit (the
   * unwaited code path calls `fetch` before yielding), and the elapsed checks are measured from
   * the arrival of the nonce that attempt actually carries.
   */
  describe('the server-published timing floor', () => {
    // Short enough to keep the suite quick, long enough that "waited" and "did not wait" cannot
    // be confused for scheduling noise.
    const FLOOR_MS = 200

    /** Queue a config GET, stamping the instant its body reaches the form. */
    const configGet = (nonce: string, sink: number[]) =>
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => {
          sink.push(Date.now())
          return { name: 'Launch list', description: 'Be first to know.', status: 'open', nonce, minAgeMs: FLOOR_MS }
        },
      }))

    /** Queue a POST, stamping the instant the request is actually issued. */
    const postOnce = (sink: number[], result: () => unknown) =>
      fetchMock.mockImplementationOnce(async () => {
        sink.push(Date.now())
        return result()
      })

    it('holds the POST until the nonce is old enough for the server to accept it', async () => {
      fetchMock.mockReset()
      const gets: number[] = []
      const posts: number[] = []
      configGet('n1', gets)
      setup()
      await screen.findByText('Launch list')

      postOnce(posts, okPost)
      typeEmail('ada@example.com')
      submitForm()

      // Held, not sent. Without the wait the request goes out in this very tick.
      expect(fetchMock).toHaveBeenCalledTimes(1)
      // ...and the visitor is told the form is working rather than looking at a dead click.
      expect(screen.getByRole('button', { name: /signing up/i })).toHaveAttribute('aria-busy', 'true')

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 })
      expect(posts[0]! - gets[0]!).toBeGreaterThanOrEqual(FLOOR_MS)
      expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    })

    // The loop itself. The retry must be measured against the SECOND nonce's arrival: a form
    // that refreshed the config without re-stamping would see the mount's timestamp, conclude
    // the floor had long passed, and fire immediately — which is the failure this pins.
    it('waits again on a prompt retry, so the replacement nonce is not spent before it is valid', async () => {
      fetchMock.mockReset()
      const gets: number[] = []
      const posts: number[] = []
      configGet('n1', gets)
      setup()
      await screen.findByText('Launch list')

      postOnce(posts, () => {
        throw new Error('rejected')
      })
      configGet('n2', gets)
      postOnce(posts, okPost)

      typeEmail('ada@example.com')
      submitForm()

      await screen.findByRole('alert')
      // Wait for the replacement config to be ADOPTED, not merely requested — retrying before
      // then would re-send the dead nonce and prove nothing about the clock.
      await waitFor(() => expect(gets).toHaveLength(2), { timeout: 3000 })

      submitForm()
      expect(fetchMock).toHaveBeenCalledTimes(3)

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4), { timeout: 3000 })
      expect(posts[1]! - gets[1]!).toBeGreaterThanOrEqual(FLOOR_MS)
      // The retry SUCCEEDS — the whole point. A form that merely waited and still failed would
      // satisfy the timing assertion above on its own.
      expect(JSON.parse(callAt(3)[1].body).nonce).toBe('n2')
      expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not delay a visitor whose nonce is already older than the floor', async () => {
      fetchMock.mockReset()
      const gets: number[] = []
      const posts: number[] = []
      configGet('n1', gets)
      setup()
      await screen.findByText('Launch list')

      // Exactly what a real visitor does: spend longer than the floor filling the form in.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, FLOOR_MS + 25))
      })

      postOnce(posts, okPost)
      typeEmail('ada@example.com')
      submitForm()

      // Same tick. The slack the form adds is slack on a wait it is already doing, never a
      // toll charged to someone who has nothing left to wait for.
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('submits immediately against a backend that publishes no floor at all', async () => {
      // The mount GET from `beforeEach` — no `minAgeMs`, as an older backend sends.
      setup()
      await screen.findByText('Launch list')
      fetchMock.mockResolvedValueOnce(okPost())

      typeEmail('ada@example.com')
      submitForm()

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})

/**
 * Split out of the component tests because the case that matters cannot be reached through a
 * render: the branch exists for the server pass a Next app makes before hydration, where there
 * is no `window` to render INTO. Testing the function directly is the only way to enter it.
 */
describe('signupSourceUrl', () => {
  it('is the page the visitor is on', () => {
    expect(signupSourceUrl()).toBe(window.location.href)
    expect(signupSourceUrl()).toMatch(/^https?:\/\/.+/)
  })

  it('is undefined with no window, so a server render omits the field rather than throwing', () => {
    vi.stubGlobal('window', undefined)
    expect(signupSourceUrl()).toBeUndefined()
  })
})
