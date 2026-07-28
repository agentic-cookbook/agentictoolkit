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

import { EmailSignupForm } from '../components/email-signup-form'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  // The mount GET that fetches display config + the nonce.
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ name: 'Launch list', description: 'Be first to know.', status: 'open', nonce: 'n1' }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
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
type FetchCall = [url: string, init: { method?: string; body: string }]
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

  it('re-enables the button after a server error so the visitor can retry', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    typeEmail('ada@example.com')
    submitForm()

    await screen.findByRole('alert')
    const button = screen.getByRole('button', { name: /sign up/i })
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-busy', 'false')
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

  it('clears the validation error once a good address is submitted', async () => {
    setup()
    await screen.findByText('Launch list')

    typeEmail('ada-at-example.com')
    submitForm()
    await screen.findByRole('alert')

    fetchMock.mockResolvedValueOnce(okPost())
    typeEmail('ada@example.com')
    submitForm()

    expect(await screen.findByText(/thanks/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

  it('sends the name when one is collected, and omits it when left blank', async () => {
    setup()
    await screen.findByText('Launch list')
    fetchMock.mockResolvedValueOnce(okPost())

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada Lovelace' } })
    typeEmail('ada@example.com')
    submitForm()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(callAt(1)[1].body).name).toBe('Ada Lovelace')
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
})
