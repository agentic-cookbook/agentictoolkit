/** The password-manager opt-out the whole fleet inherits from `Input`/`Textarea`.
 *
 *  What is worth pinning here is NOT that six attributes are spelled correctly —
 *  that would just restate `lib/autofill`, and a test that restates the thing it
 *  tests agrees with it by construction. It is the two decisions the primitives
 *  make on the caller's behalf, both of which are silent when they go wrong:
 *
 *    1. A field says nothing about autofill  → it gets the opt-out. Nobody has to
 *       remember to ask, which is the only reason ~80 fields across 42 sites are
 *       covered.
 *    2. A field names a real autofill token  → it gets NONE of it. This is the
 *       leg that breaks sign-in if it regresses, and it breaks it invisibly: the
 *       page still renders, the manager just stops offering the credential.
 *
 *  Both are asserted through the rendered DOM rather than against the exported
 *  object, so a spread that lands in the wrong place (after `{...props}`, or on a
 *  wrapper instead of the field) fails here. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Input } from '../components/input'
import { Textarea } from '../components/textarea'
import { noAutofillProps } from '../lib/autofill'

/** Every attribute the opt-out emits, as `[attribute, value]` DOM pairs.
 *  Derived from the module so a vendor added there is asserted here without a
 *  second list to keep in step — `autoComplete` is the one JSX-cased key. */
const OPT_OUT_ATTRS = Object.entries(noAutofillProps).map(
  ([key, value]) => [key === 'autoComplete' ? 'autocomplete' : key, value] as const,
)

describe('Input / Textarea password-manager opt-out', () => {
  it('opts a field out when it says nothing about autofill', () => {
    render(<Input aria-label="Title" />)
    const field = screen.getByLabelText('Title')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('opts a textarea out too', () => {
    render(<Textarea aria-label="Body" />)
    const field = screen.getByLabelText('Body')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('treats autoComplete="off" as no token and still opts out', () => {
    // "off" is the same request the opt-out makes, only weaker — a field saying
    // it is not asking for autofill is not a field asking for a vault.
    render(<Input aria-label="Filter" autoComplete="off" />)
    const field = screen.getByLabelText('Filter')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('emits NOTHING for a field naming a real autofill token', () => {
    // The sign-in case. A credential field asks for the manager with the standard
    // attribute, and that has to be the whole declaration — no fleet-private
    // opt-in beside it.
    render(<Input aria-label="Password" type="password" autoComplete="current-password" />)
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('autocomplete', 'current-password')
    for (const [attr] of OPT_OUT_ATTRS) {
      if (attr === 'autocomplete') continue
      expect(field).not.toHaveAttribute(attr)
    }
  })

  it('lets a caller clear one attribute without giving up the rest', () => {
    // The spread goes in BEFORE `{...props}` precisely so this works: a field
    // fighting one manager's heuristic can drop that one attribute and keep the
    // other five.
    render(<Input aria-label="Odd one" data-1p-ignore={undefined} />)
    const field = screen.getByLabelText('Odd one')
    expect(field).not.toHaveAttribute('data-1p-ignore')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      if (attr === 'data-1p-ignore') continue
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('is not degraded by an explicit autoComplete={undefined}', () => {
    // The one prop that must NOT be clearable that way, because clearing it is
    // never what the caller meant. `<Input autoComplete={x}/>` with an optional
    // `x` that happens to be absent passes the key explicitly as `undefined` —
    // a wrapper forwarding its own optional prop does this without meaning
    // anything by it — and that used to reach `{...props}` and delete the bag's
    // own `off`, leaving five vendor attributes and nothing said to the browser.
    render(<Input aria-label="Forwarded" autoComplete={undefined} />)
    const field = screen.getByLabelText('Forwarded')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('reads a token case-insensitively, so "Off" is still no token', () => {
    // The HTML attribute is case-insensitive, so `"Off"` is the same instruction
    // as `"off"`. A raw `!== 'off'` read it as a real token and handed the field
    // back to every manager — with the field still rendering, still saying off.
    render(<Input aria-label="Shouty" autoComplete=" Off " />)
    const field = screen.getByLabelText('Shouty')
    for (const [attr, value] of OPT_OUT_ATTRS) {
      expect(field).toHaveAttribute(attr, value)
    }
  })

  it('still emits nothing for a token that only differs in case', () => {
    render(<Input aria-label="Shouty password" type="password" autoComplete="Current-Password" />)
    const field = screen.getByLabelText('Shouty password')
    for (const [attr] of OPT_OUT_ATTRS) {
      if (attr === 'autocomplete') continue
      expect(field).not.toHaveAttribute(attr)
    }
  })
})
