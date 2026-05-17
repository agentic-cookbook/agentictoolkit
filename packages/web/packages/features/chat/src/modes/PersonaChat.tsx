'use client'

import type { ChatBackend } from '../backends/types'
import type { ChatParticipant, ChatMode } from '../types'
import { InlineChat, type InlineChatSizing } from './InlineChat'
import { ThreePaneChat } from './ThreePaneChat'
import { MobileChat } from './MobileChat'

export interface PersonaChatProps {
  mode: ChatMode
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
  className?: string
  /** Inline mode only: how the chat box sizes itself. */
  sizing?: InlineChatSizing
  /** Mobile mode only: whether the overlay is open */
  open?: boolean
  /** Mobile mode only: called when the user closes the overlay */
  onClose?: () => void
}

export function PersonaChat({ mode, ...props }: PersonaChatProps) {
  switch (mode) {
    case 'inline':
      return (
        <InlineChat
          backend={props.backend}
          persona={props.persona}
          user={props.user}
          welcomeMessage={props.welcomeMessage}
          className={props.className}
          sizing={props.sizing}
        />
      )
    case 'three-pane':
      return (
        <ThreePaneChat
          backend={props.backend}
          persona={props.persona}
          user={props.user}
          welcomeMessage={props.welcomeMessage}
          className={props.className}
        />
      )
    case 'mobile':
      return (
        <MobileChat
          backend={props.backend}
          persona={props.persona}
          user={props.user}
          welcomeMessage={props.welcomeMessage}
          open={props.open ?? false}
          onClose={props.onClose ?? (() => {})}
        />
      )
  }
}
