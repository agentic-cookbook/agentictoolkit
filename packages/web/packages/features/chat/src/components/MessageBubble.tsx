'use client'

import type { ChatMessage, ToolCallInfo } from '../types'
import { RichContent } from './RichContent'
import { useAllImagesLoaded } from '../hooks/useAllImagesLoaded'
import { ConnectorAnchor } from '../modes/three-pane/connectors/ConnectorAnchor'

interface MessageBubbleProps {
  message: ChatMessage
  index?: number
  isSelected?: boolean
  onClick?: () => void
  showDetailArrow?: boolean
  onDetailArrowClick?: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ToolCallPill({ call }: { call: ToolCallInfo }) {
  const label =
    call.status === 'started'
      ? `Calling ${call.name}…`
      : call.status === 'completed'
        ? `${call.name} ✓`
        : `${call.name} ✗`
  return (
    <span className={`pc-tool-call pc-tool-call-${call.status}`} title={call.arguments}>
      {label}
    </span>
  )
}

export function MessageBubble({
  message,
  index,
  isSelected = false,
  onClick,
  showDetailArrow = false,
  onDetailArrowClick,
}: MessageBubbleProps) {
  const className = [
    'pc-message',
    message.isPersona ? 'pc-persona' : 'pc-user',
    isSelected ? 'pc-message-selected' : '',
    message.isStreaming ? 'pc-message-streaming' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const allImagesLoaded = useAllImagesLoaded(message.content)
  if (!allImagesLoaded) return null

  return (
    <div
      className={className}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="pc-bubble">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="pc-tool-calls">
            {message.toolCalls.map((call, i) => (
              <ToolCallPill key={i} call={call} />
            ))}
          </div>
        )}
        <div className="pc-text">{message.text}</div>
        {message.content && message.content.length > 0 && (
          <RichContent items={message.content} />
        )}
        <div className="pc-time">{formatTime(message.timestamp)}</div>
      </div>
      {showDetailArrow && (
        <button
          className="pc-detail-arrow"
          aria-label="Show details"
          onClick={(e) => {
            e.stopPropagation()
            onDetailArrowClick?.()
          }}
        >
          ›
        </button>
      )}
      {message.popover && index !== undefined && (
        <ConnectorAnchor id={`msg-${index}-out`} className="pc-connector-anchor-out" />
      )}
    </div>
  )
}
