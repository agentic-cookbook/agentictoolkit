'use client'

import type { RefObject } from 'react'
import type { ChatBackend } from '../backends/types'
import type { ChatParticipant } from '../types'
import { useChatSession, type ChatSession } from '../hooks/useChatSession'
import { useContentHuggingSize } from '../hooks/useContentHuggingSize'
import { Transcript } from '../components/Transcript'
import { ChatInput } from '../components/ChatInput'
import { InlinePopover } from '../components/InlinePopover'

/**
 * How the inline chat box determines its outer height.
 *
 * - `fixed`: respect whatever height the surrounding CSS gives the wrapper
 *   (today's behavior — `.pc-inline` is 50vh capped at 600px).
 * - `content-hugging`: the box height equals its content. Because the wrapper
 *   is bottom-anchored, growth extends the top edge upward and the input bar
 *   stays put. `maxHeight` caps growth; past the cap the transcript scrolls.
 */
export type InlineChatSizing =
  | { mode: 'fixed' }
  | {
      mode: 'content-hugging'
      maxHeight:
        | { kind: 'css'; value: string }
        | { kind: 'viewport-offset'; topOffsetPx: number }
        | {
            kind: 'element-offset'
            ref: RefObject<HTMLElement | null>
            gapPx?: number
          }
    }

export interface InlineChatViewProps {
  session: ChatSession
  className?: string
  sizing?: InlineChatSizing
}

export function InlineChatView({ session, className, sizing }: InlineChatViewProps) {
  const { messages, isTyping, sendMessage } = session
  const { ref, style } = useContentHuggingSize(sizing)
  return (
    <div ref={ref} className={`persona-chat ${className || ''}`} style={style}>
      <Transcript
        messages={messages}
        isTyping={isTyping}
        renderPopover={(msg) =>
          msg.popover ? <InlinePopover data={msg.popover} /> : null
        }
      />
      <ChatInput onSend={sendMessage} />
    </div>
  )
}

export interface InlineChatProps {
  backend: ChatBackend
  persona: ChatParticipant
  user?: ChatParticipant
  welcomeMessage?: string
  className?: string
  sizing?: InlineChatSizing
}

export function InlineChat(props: InlineChatProps) {
  const session = useChatSession(props)
  return <InlineChatView session={session} className={props.className} sizing={props.sizing} />
}
