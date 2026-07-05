"use client"

import * as React from "react"

import { Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/dialog"
import { RecipientInput } from "../components/recipient-input"
import { Textarea } from "../components/textarea"
import { AlertModal } from "../components/alert-modal"
import { Button } from "../components/button"
import { FieldGroup } from "../blocks/field-group"
import { Field } from "../blocks/field"

export interface SendInvitationPayload {
  email?: { recipients: string[]; note: string }
  sms?: { recipients: string[]; note: string }
}

export interface SendInvitationModalProps {
  open: boolean
  /** Seed list for the Email section. Section is hidden when empty/absent. */
  emails?: string[]
  /** Seed list for the SMS section. Section is hidden when empty/absent. */
  phones?: string[]
  onSend: (payload: SendInvitationPayload) => void
  onClose: () => void
  busy?: boolean
  title?: string
}

/**
 * Modal for sending invitations via email and/or SMS.
 *
 * State is initialized from the seed props. To re-seed when the parent opens
 * the modal with a new selection, the parent should pass a changing `key` prop
 * (e.g. derived from the seed lists) so React remounts this component freshly.
 */
export function SendInvitationModal({
  open,
  emails,
  phones,
  onSend,
  onClose,
  busy = false,
  title = "Send invitation",
}: SendInvitationModalProps): React.ReactElement {
  const hasEmail = (emails?.length ?? 0) > 0
  const hasSms = (phones?.length ?? 0) > 0

  // State is derived from seeds at mount time; parent re-seeds via key changes.
  const [emailRecipients, setEmailRecipients] = React.useState<string[]>(emails ?? [])
  const [smsRecipients, setSmsRecipients] = React.useState<string[]>(phones ?? [])
  const [emailNote, setEmailNote] = React.useState("")
  const [smsNote, setSmsNote] = React.useState("")
  const [confirming, setConfirming] = React.useState(false)

  // Dirty = any recipients or notes present (seeded recipients count as content).
  const dirty =
    emailRecipients.length > 0 ||
    smsRecipients.length > 0 ||
    emailNote !== "" ||
    smsNote !== ""

  const canSend =
    (hasEmail && emailRecipients.length > 0) ||
    (hasSms && smsRecipients.length > 0)

  function reset(): void {
    setEmailRecipients(emails ?? [])
    setSmsRecipients(phones ?? [])
    setEmailNote("")
    setSmsNote("")
    setConfirming(false)
  }

  function close(): void {
    reset()
    onClose()
  }

  function requestCancel(): void {
    if (dirty) {
      setConfirming(true)
    } else {
      close()
    }
  }

  function send(): void {
    const payload: SendInvitationPayload = {}
    if (hasEmail && emailRecipients.length > 0) {
      payload.email = { recipients: emailRecipients, note: emailNote }
    }
    if (hasSms && smsRecipients.length > 0) {
      payload.sms = { recipients: smsRecipients, note: smsNote }
    }
    onSend(payload)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) requestCancel() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-apt-gold">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {hasSms && (
              <FieldGroup title="SMS">
                <Field label="Recipients">
                  <RecipientInput
                    kind="phone"
                    ariaLabel="SMS recipients"
                    value={smsRecipients}
                    onChange={setSmsRecipients}
                    separateInput
                  />
                </Field>
                <Field label="Note (optional)">
                  <Textarea
                    value={smsNote}
                    onChange={(e) => setSmsNote(e.target.value)}
                  />
                </Field>
              </FieldGroup>
            )}
            {hasEmail && (
              <FieldGroup title="Email">
                <Field label="Recipients">
                  <RecipientInput
                    kind="email"
                    ariaLabel="Email recipients"
                    value={emailRecipients}
                    onChange={setEmailRecipients}
                    separateInput
                  />
                </Field>
                <Field label="Note (optional)">
                  <Textarea
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                  />
                </Field>
              </FieldGroup>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={requestCancel}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canSend || busy} onClick={send}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertModal
        open={confirming}
        destructive
        title="Discard this invitation?"
        cancelLabel="Keep editing"
        onCancel={() => setConfirming(false)}
        confirmLabel="Discard"
        onConfirm={close}
      />
    </>
  )
}
