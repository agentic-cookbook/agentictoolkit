'use client'

// The DM conversation list (messaging P5). Each row is the other participant, a
// last-message preview, an unread Badge, and a PresenceDot. Composes the shared
// @agenticdevelopertoolkit/ui primitives (Avatar, Badge, Spinner, EmptyState, Tooltip) so it
// renders identically to the rest of the platform chrome. Presentational: the
// conversations + loading/error come in as props (DmPanel owns the single
// useDmConversations fetch); a row click calls `onSelect(chatId)` and the active
// row is marked `aria-current`.

import { MessageSquare } from 'lucide-react'

import { Avatar, AvatarFallback } from '@agenticdevelopertoolkit/ui/components/avatar'
import { Badge } from '@agenticdevelopertoolkit/ui/components/badge'
import { Button } from '@agenticdevelopertoolkit/ui/components/button'
import { EmptyState } from '@agenticdevelopertoolkit/ui/components/empty-state'
import { Spinner } from '@agenticdevelopertoolkit/ui/components/spinner'
import { TooltipProvider } from '@agenticdevelopertoolkit/ui/components/tooltip'
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text'

import { type DmConversation } from '../hooks/use-dms'
import { PresenceDot } from './presence-dot'
import { cx, formatRelativeTime, initialsOf } from './util'

function ConversationRow({
  chat,
  selected,
  onSelect,
}: {
  chat: DmConversation
  selected: boolean
  onSelect: (chatId: string) => void
}) {
  const relative = chat.lastMessage ? formatRelativeTime(chat.lastMessage.dateSent) : ''
  const unread = chat.unreadCount > 0
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(chat.chatId)}
        aria-current={selected ? 'true' : undefined}
        className={cx(
          'flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors',
          selected
            ? 'border-l-apt-gold bg-apt-surface-2 text-apt-text'
            : 'border-transparent text-apt-text-muted hover:bg-apt-surface-2/50 hover:text-apt-text',
        )}
      >
        {/* Avatar with an overlaid presence dot. */}
        <span className="relative shrink-0">
          <Avatar className="size-9">
            <AvatarFallback>{initialsOf(chat.otherUserId)}</AvatarFallback>
          </Avatar>
          <PresenceDot
            online={chat.online}
            lastSeenAt={chat.lastSeenAt}
            className="absolute -right-0.5 -bottom-0.5 rounded-full bg-apt-surface p-0.5"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cx(
                'truncate text-sm',
                unread ? 'font-semibold text-apt-text' : 'font-medium',
              )}
            >
              {chat.otherUserId}
            </span>
            {relative && (
              <time
                dateTime={chat.lastMessage?.dateSent}
                className="shrink-0 text-xs text-apt-text-dim"
              >
                {relative}
              </time>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="line-clamp-1 flex-1 text-xs text-apt-text-muted">
              {chat.lastMessage?.body || 'No messages yet'}
            </span>
            {unread && (
              <Badge
                variant="blue"
                className="shrink-0 px-1.5 py-0"
                aria-label={`${chat.unreadCount} unread`}
              >
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </Badge>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export function DmList({
  chats,
  loading,
  error,
  selectedChatId,
  onSelect,
  className,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: {
  chats: DmConversation[]
  loading: boolean
  error: string | null
  selectedChatId: string | null
  onSelect: (chatId: string) => void
  className?: string
  /** More conversations exist beyond the loaded set → show the load-more control. */
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
}) {
  return (
    <TooltipProvider>
      <nav
        className={cx('flex min-h-0 flex-col', className)}
        aria-label="Direct message conversations"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-apt-text-muted">
              <Spinner />
              <span>Loading conversations…</span>
            </div>
          ) : error ? (
            <ErrorText error={error} className="px-4 py-6" />
          ) : chats.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<MessageSquare aria-hidden="true" />}
                title="No conversations yet."
                description="Direct messages you start or receive will appear here."
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-apt-border">
                {chats.map((chat) => (
                  <ConversationRow
                    key={chat.chatId}
                    chat={chat}
                    selected={chat.chatId === selectedChatId}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
              {hasMore && (
                <div className="p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-apt-text-muted"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? <Spinner className="text-current" /> : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </nav>
    </TooltipProvider>
  )
}
