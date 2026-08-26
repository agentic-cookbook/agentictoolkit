'use client'

import { useRef, type RefObject } from 'react'
import { SendIcon } from './SendIcon'

interface ChatInputProps {
  onSend: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
}

export function ChatInput({
  onSend,
  placeholder = 'Type a message...',
  autoFocus = false,
  inputRef: externalRef,
}: ChatInputProps) {
  const internalRef = useRef<HTMLInputElement>(null)
  const ref = externalRef || internalRef

  const handleSend = () => {
    const input = ref.current
    if (!input) return
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    onSend(text)
  }

  return (
    /* A form, not a div, and that is what stops iOS offering "AutoFill Contact"
       above the keyboard. An input with no form ancestor is scoped for autofill
       against the whole DOCUMENT, so Safari classifies it from whatever else the
       page happens to say — on a site with a contact section and an address to
       write to, a lone text field reads as the place to put your details, and the
       keyboard offers the reader's own contact card.

       This was measured on iOS 26 by the twin of this component in
       agenticdevelopertoolkit (packages/chat/src/components/ChatInput.tsx), not
       reasoned about: stripping EVERY attribute off the input — down to a bare
       `<input type="text">`, opt-outs included — did not move it, and what fixed
       it was giving the field a form of its own to be scoped against. The
       attributes below stay because they are what keeps the password managers
       out, which is a different problem from Safari's classifier.

       The element carries `pc-input-area` unchanged, so it is still the flex bar
       every skin styles — the tag is the only thing that changed. Submitting is
       now a real submit, which is also what `enterKeyHint="send"` has been
       promising the on-screen keyboard all along. */
    <form
      className="pc-input-area"
      data-form-type="other"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        handleSend()
      }}
    >
      <input
        ref={ref}
        className="pc-input"
        type="text"
        inputMode="text"
        name="message"
        aria-label="Message"
        placeholder={placeholder}
        // A chat composer is never a credential field. `autoComplete="off"` speaks
        // only to the browser, so each manager also needs its own ignore attribute —
        // the list of record is `@agenticdevelopertoolkit/ui/lib/autofill`, copied inline because
        // this package ships zero runtime dependencies. Keeping them out is not only
        // cosmetic: Dashlane plants `data-dashlane-rid` on the field, and a mutation
        // between SSR and hydration is a React hydration mismatch.
        autoComplete="off"
        data-form-type="other"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-protonpass-ignore="true"
        autoFocus={autoFocus}
        enterKeyHint="send"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      {/* Submits the form rather than calling handleSend directly — one send path,
          so the button and the keyboard's Send key cannot drift apart. The Enter
          handler above still preventDefaults, so it never also submits and nothing
          is sent twice. */}
      <button className="pc-send-btn" type="submit" aria-label="Send">
        <SendIcon />
      </button>
    </form>
  )
}
