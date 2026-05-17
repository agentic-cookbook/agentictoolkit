'use client'

import { useEffect, useRef } from 'react'
import type { ChatBackend } from '../backends/types'
import type { ChatParticipant } from '../types'
import { useChatSession, type ChatSession } from '../hooks/useChatSession'
import { Transcript } from '../components/Transcript'
import { ChatInput } from '../components/ChatInput'

export interface MobileChatViewProps {
  session: ChatSession
  open: boolean
  onClose: () => void
  closeLabel?: string
}

export function MobileChatView({
  session,
  open,
  onClose,
  closeLabel = '← back',
}: MobileChatViewProps) {
  const { messages, isTyping, sendMessage } = session
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when chat opens (triggers keyboard on iOS)
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(timer)
  }, [open])

  return (
    <div className={`pc-mobile-overlay ${open ? 'open' : ''}`}>
      <div className="pc-mobile-header">
        <button className="pc-mobile-close" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
      <div className="persona-chat pc-mobile-widget">
        <Transcript messages={messages} isTyping={isTyping} />
        <ChatInput onSend={sendMessage} inputRef={inputRef} />
      </div>
    </div>
  )
}

export interface MobileChatProps {
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
  open: boolean
  onClose: () => void
  closeLabel?: string
}

export function MobileChat({
  backend,
  persona,
  user,
  welcomeMessage,
  open,
  onClose,
  closeLabel,
}: MobileChatProps) {
  const session = useChatSession({ backend, persona, user, welcomeMessage })
  return (
    <MobileChatView
      session={session}
      open={open}
      onClose={onClose}
      closeLabel={closeLabel}
    />
  )
}
