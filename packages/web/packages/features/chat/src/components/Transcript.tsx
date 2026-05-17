'use client'

import { useRef, type ReactNode } from 'react'
import type { ChatMessage } from '../types'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { useScrollToBottom } from '../hooks/useScrollToBottom'

interface TranscriptProps {
  messages: ChatMessage[]
  isTyping: boolean
  selectedIndex?: number
  onMessageClick?: (index: number) => void
  renderPopover?: (message: ChatMessage) => ReactNode
  showDetailArrows?: boolean
  onDetailArrowClick?: (index: number) => void
  className?: string
}

export function Transcript({
  messages,
  isTyping,
  selectedIndex = -1,
  onMessageClick,
  renderPopover,
  showDetailArrows = false,
  onDetailArrowClick,
  className,
}: TranscriptProps) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollToBottom(ref, [messages.length, isTyping])

  return (
    <div ref={ref} className={`pc-transcript ${className || ''}`}>
      {messages.map((msg, i) => (
        <div key={msg.id}>
          <MessageBubble
            message={msg}
            index={i}
            isSelected={i === selectedIndex}
            onClick={onMessageClick ? () => onMessageClick(i) : undefined}
            showDetailArrow={showDetailArrows && !!msg.popover}
            onDetailArrowClick={
              onDetailArrowClick ? () => onDetailArrowClick(i) : undefined
            }
          />
          {renderPopover && msg.popover && renderPopover(msg)}
        </div>
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  )
}
