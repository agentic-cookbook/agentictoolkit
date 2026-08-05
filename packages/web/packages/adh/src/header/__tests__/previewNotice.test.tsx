/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  PreviewNotice,
  DEFAULT_PREVIEW_NOTICE,
  DEFAULT_PREVIEW_DETAIL,
} from '../PreviewNotice'

const trigger = (): HTMLElement =>
  screen.getByRole('button', { name: DEFAULT_PREVIEW_NOTICE })

describe('PreviewNotice', () => {
  it('flanks the headline with caution icons and ends with the caret', () => {
    const { container } = render(<PreviewNotice />)
    // Order is the requirement, not merely presence: a caution BEFORE and AFTER the
    // words, then the affordance that says there is more. Read off the trigger's own
    // children so a stray icon elsewhere in the strip can't satisfy it.
    //
    // `classList`, not `className`: two of these are SVGs, whose className is an
    // SVGAnimatedString rather than a string — and lucide merges its own `lucide
    // lucide-*` classes in alongside ours, so this has to be containment, not equality.
    const ROLES = [
      'adh-header__preview-icon',
      'adh-header__preview-text',
      'adh-header__preview-caret',
    ]
    const parts = Array.from(trigger().children).map(
      (el) => ROLES.find((c) => el.classList.contains(c)) ?? `unclassified:${el.tagName}`,
    )
    expect(parts).toEqual([
      'adh-header__preview-icon',
      'adh-header__preview-text',
      'adh-header__preview-icon',
      'adh-header__preview-caret',
    ])
    // The icons carry no accessible text — the button's name is the notice alone, which
    // is what makes `getByRole('button', { name: DEFAULT_PREVIEW_NOTICE })` above work
    // at all. Asserted so a later `aria-label` on a decorative glyph is caught here
    // rather than by a screen reader hearing "warning warning".
    expect(container.querySelectorAll('.adh-header__preview-icon[aria-hidden]')).toHaveLength(2)
  })

  it('starts closed — the detail is not in the document until asked for', () => {
    render(<PreviewNotice />)
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    // Closed, `aria-controls` would point at nothing, so it is absent rather than dangling.
    expect(trigger()).not.toHaveAttribute('aria-controls')
  })

  it('opens the panel on click, wired to the trigger', () => {
    render(<PreviewNotice />)
    fireEvent.click(trigger())
    const panel = screen.getByText(DEFAULT_PREVIEW_DETAIL)
    expect(panel).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(trigger()).toHaveAttribute('aria-controls', panel.id)
  })

  it('dismisses on a click anywhere else in the document', () => {
    render(<PreviewNotice />)
    fireEvent.click(trigger())
    fireEvent.click(document.body)
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
  })

  it('dismisses on a click INSIDE the panel — anywhere means anywhere', () => {
    render(<PreviewNotice />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByText(DEFAULT_PREVIEW_DETAIL))
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
  })

  // The regression the trigger's carve-out in that document listener exists for: the
  // listener is capture-phase, so it runs BEFORE React's delegated handler. Without the
  // carve-out this click would close and then be toggled straight back open, and the
  // one control that opened the panel could never close it.
  it('closes again on a second trigger click, not re-opens', () => {
    render(<PreviewNotice />)
    fireEvent.click(trigger())
    fireEvent.click(trigger())
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('dismisses when the pointer leaves the trigger-and-panel pair', () => {
    const { container } = render(<PreviewNotice />)
    fireEvent.click(trigger())
    fireEvent.mouseLeave(container.querySelector('.adh-header__preview-disclosure')!)
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
  })

  it('dismisses on Escape', () => {
    render(<PreviewNotice />)
    fireEvent.click(trigger())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(DEFAULT_PREVIEW_DETAIL)).toBeNull()
  })

  // The package draws the disclosure; the host owns the words. Both defaults are
  // defaults, not fixtures.
  it('takes the host’s words for both the headline and the detail', () => {
    render(<PreviewNotice notice="Closed Beta" detail="Invitations only, for now." />)
    const host = screen.getByRole('button', { name: 'Closed Beta' })
    fireEvent.click(host)
    expect(screen.getByText('Invitations only, for now.')).toBeInTheDocument()
    expect(screen.queryByText(DEFAULT_PREVIEW_NOTICE)).toBeNull()
  })
})
