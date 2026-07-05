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
  it('confirms before cancelling when content is present', () => {
    const onClose = vi.fn()
    render(<SendInvitationModal open emails={['a@x.io']} onSend={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()                          // discard confirm first
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalled()
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

  // SI-1: each section has a separate recipients chip box AND a separate add-input
  it('each section shows a recipients chip box and a separate add-input', () => {
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    )
    // Two separate add-input elements (one per section)
    const emailAddInput = screen.getByRole('textbox', { name: 'Add to Email recipients' })
    const smsAddInput = screen.getByRole('textbox', { name: 'Add to SMS recipients' })
    expect(emailAddInput).toBeTruthy()
    expect(smsAddInput).toBeTruthy()

    // Two separate chip boxes (data-testid="recipients-box")
    const recipientBoxes = screen.getAllByTestId('recipients-box')
    expect(recipientBoxes).toHaveLength(2)

    // The add-inputs and chip boxes must be distinct elements (not the same node)
    expect(emailAddInput).not.toBe(recipientBoxes[0])
    expect(smsAddInput).not.toBe(recipientBoxes[1])
  })

  // SI-1: typing in the add-input + Enter adds a chip to the box
  it('typing in the email add-input and pressing Enter adds a chip', () => {
    const onSend = vi.fn()
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={onSend}
        onClose={vi.fn()}
      />
    )
    const emailAddInput = screen.getByRole('textbox', { name: 'Add to Email recipients' })
    fireEvent.change(emailAddInput, { target: { value: 'new@x.io' } })
    fireEvent.keyDown(emailAddInput, { key: 'Enter' })

    // The new recipient chip should now appear in the email recipients box
    const recipientBoxes = screen.getAllByTestId('recipients-box')
    // email box is second (SMS is first per SI-7)
    const emailBox = recipientBoxes[1]!
    expect(within(emailBox).getByText('new@x.io')).toBeTruthy()
  })

  // SI-1: typing in the SMS add-input + Enter adds a chip to the SMS box
  it('typing in the SMS add-input and pressing Enter adds a chip', () => {
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const smsAddInput = screen.getByRole('textbox', { name: 'Add to SMS recipients' })
    fireEvent.change(smsAddInput, { target: { value: '+1 555 9999' } })
    fireEvent.keyDown(smsAddInput, { key: 'Enter' })

    // The new recipient chip should now appear in the SMS recipients box
    const recipientBoxes = screen.getAllByTestId('recipients-box')
    const smsBox = recipientBoxes[0]! // SMS is first
    expect(within(smsBox).getByText('+1 555 9999')).toBeTruthy()
  })

  // SI-1: removing a chip via its × button works
  it('clicking a chip remove button removes that chip from the box', () => {
    render(
      <SendInvitationModal
        open
        emails={['a@x.io', 'b@x.io']}
        phones={['+1 555 0100']}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    )
    // Verify a@x.io is visible in the email recipients box before removal
    const recipientBoxes = screen.getAllByTestId('recipients-box')
    const emailBox = recipientBoxes[1]! // email is second
    expect(within(emailBox).getByText('a@x.io')).toBeTruthy()

    // Click the remove button for a@x.io
    fireEvent.click(screen.getByRole('button', { name: 'Remove a@x.io' }))

    // a@x.io should be gone; b@x.io still present
    expect(within(emailBox).queryByText('a@x.io')).toBeNull()
    expect(within(emailBox).getByText('b@x.io')).toBeTruthy()
  })

  // Send payload only includes populated sections
  it('Send payload includes only sections that have recipients', () => {
    const onSend = vi.fn()
    render(
      <SendInvitationModal
        open
        emails={['a@x.io']}
        phones={['+1 555 0100']}
        onSend={onSend}
        onClose={vi.fn()}
      />
    )
    // Remove the SMS recipient so only email remains
    fireEvent.click(screen.getByRole('button', { name: 'Remove +1 555 0100' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    // Payload should only include email, not sms
    expect(onSend).toHaveBeenCalledWith({ email: { recipients: ['a@x.io'], note: '' } })
    expect(onSend).not.toHaveBeenCalledWith(expect.objectContaining({ sms: expect.anything() }))
  })
})
