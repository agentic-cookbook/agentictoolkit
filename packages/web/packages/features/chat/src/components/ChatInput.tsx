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
    <div className="pc-input-area">
      <input
        ref={ref}
        className="pc-input"
        type="text"
        inputMode="text"
        placeholder={placeholder}
        // A chat composer is never a credential field. `autoComplete="off"` speaks
        // only to the browser, so each manager also needs its own ignore attribute —
        // the list of record is `@agentic-toolkit/ui/lib/autofill`, copied inline because
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
      <button
        className="pc-send-btn"
        aria-label="Send"
        onClick={handleSend}
      >
        <SendIcon />
      </button>
    </div>
  )
}
