import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SendInvitationModal } from '../blocks/send-invitation-modal'

describe('SendInvitationModal', () => {
  it('renders only the Email section when only emails are seeded', () => {
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.queryByText('SMS')).toBeNull()
  })
  it('sends a payload with only the populated section', () => {
    const onSend = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={onSend} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledWith({ email: { recipients: ['a@x.io'], note: '' } })
  })
  it('disables Send when no section has recipients', () => {
    render(<SendInvitationModal open emails={[]} phones={[]} onSend={vi.fn()} onClose={vi.fn()} />)
    // no sections render; Send is disabled
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })
  it('confirms before cancelling once a note has been entered', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={onClose} />)
    // Recipients are read-only/seeded, so only an entered note makes the form dirty. The single
    // textbox in an email-only modal is the note field (there is no add-recipient input).
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'welcome!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()                          // discard confirm first
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalled()
  })
  it('the discard confirm is the platform alert: Stay aborts the cancel and keeps the note', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'welcome!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // "Stay", not the bespoke "Keep editing" this modal used to render — the wording now comes
    // from UnsavedChangesAlert, so this pins the shared prompt rather than a local literal.
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox')).toHaveValue('welcome!')
  })
  it('closes directly on Cancel when only recipients are seeded (no note)', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()                              // seeded recipients aren't "dirty"
  })
  it('renders only the SMS section when only phones are seeded', () => {
    render(<SendInvitationModal open phones={['+1 555 0100']} onSend={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('SMS')).toBeTruthy()
    expect(screen.queryByText('Email')).toBeNull()
  })
  it('renders both sections when both emails and phones are seeded', () => {
    render(<SendInvitationModal open emails={['a@x.io']} phones={['+1 555 0100']} onSend={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.getByText('SMS')).toBeTruthy()
  })
  it('closes directly on Cancel when nothing is populated', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={[]} phones={[]} onSend={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  // SI-7: SMS section appears before Email in DOM order
  it('renders SMS FieldGroup before Email FieldGroup in DOM order', () => {
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const smsHeading = screen.getByText('SMS')
    const emailHeading = screen.getByText('Email')
    // compareDocumentPosition: Node.DOCUMENT_POSITION_FOLLOWING = 4
    // smsHeading.compareDocumentPosition(emailHeading) & 4 means email comes after SMS
    expect(smsHeading.compareDocumentPosition(emailHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // SI-1: each section shows a READ-ONLY recipients chip box (seeded from the selection the backend
  // keys the invite off) — no add-input, no remove ×, since edits would be silently dropped server-side.
  it('shows read-only recipient chips with no add-input and no remove buttons', () => {
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    )
    // Two separate chip boxes (data-testid="recipients-box"), each showing its seeded recipient.
    const recipientBoxes = screen.getAllByTestId('recipients-box')
    expect(recipientBoxes).toHaveLength(2)
    expect(within(recipientBoxes[0]!).getByText('+1 555 0100')).toBeTruthy() // SMS first per SI-7
    expect(within(recipientBoxes[1]!).getByText('a@x.io')).toBeTruthy()

    // No add-input in either section…
    expect(screen.queryByRole('textbox', { name: 'Add to Email recipients' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Add to SMS recipients' })).toBeNull()
    // …and no remove affordance on the read-only chips.
    expect(screen.queryByRole('button', { name: 'Remove a@x.io' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove +1 555 0100' })).toBeNull()
  })

  // Send payload includes only the sections that were SEEDED with recipients (editing is not offered).
  it('Send payload includes only sections that have seeded recipients', () => {
    const onSend = vi.fn()
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        onSend={onSend}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    // Payload should only include email, not sms.
    expect(onSend).toHaveBeenCalledWith({ email: { recipients: ['a@x.io'], note: '' } })
    expect(onSend).not.toHaveBeenCalledWith(expect.objectContaining({ sms: expect.anything() }))
  })

  // The alert must be mounted INSIDE <DialogContent>, not as a sibling of the outer <Dialog>,
  // because the outer dialog is still open while the alert asks whether to close it — two
  // stacked base-ui modal Dialogs, one of which must be registered as the other's NESTED dialog
  // or base-ui's inerting can trap the user in a dialog they can neither dismiss nor confirm.
  //
  // In jsdom, `discard.closest('[aria-hidden="true"]')`/`closest('[inert]')` are NOT
  // discriminating: base-ui always keeps the most-recently-opened Dialog.Root interactive and
  // inerts the other regardless of React-tree placement (verified by rendering both the sibling
  // and the nested shape and diffing the DOM) — so they pass here even against the pre-fix
  // sibling placement, and are asserted only as a sanity floor, not proof.
  //
  // The actual proof is `data-nested-dialog-open`: base-ui's DialogPopup sets it on the OUTER
  // popup only when a descendant Dialog.Root registers itself as nested through the
  // DialogRootContext React (not DOM) tree — see @base-ui/react's
  // dialog/popup/DialogPopupDataAttributes.js and dialog/root/useDialogRoot.js. A
  // sibling-mounted alert is an unrelated, independent Dialog.Root that never reaches that
  // context, so the attribute stays absent even though the alert renders on top and looks fine.
  it('is registered as a NESTED dialog of the modal it gates, not an independent sibling', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'welcome!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const discard = screen.getByRole('button', { name: 'Discard' })
    expect(discard.closest('[aria-hidden="true"]')).toBeNull()
    expect(discard.closest('[inert]')).toBeNull()

    const outerDialog = screen.getByText('Send invitation').closest('[role="dialog"]')
    expect(outerDialog).toHaveAttribute('data-nested-dialog-open')
  })
})
