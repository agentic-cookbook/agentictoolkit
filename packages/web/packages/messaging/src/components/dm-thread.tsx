'use client'

// A single DM thread (messaging P5): a scrollable message log plus a composer.
// Own messages sit right-aligned on an apt-blue-tinted surface; the other party's
// sit left on apt-surface-2 (all colour via apt-* tokens). New messages arrive
// live over SSE (see useDmThread) and the log auto-scrolls to the newest. The log
// is an aria-live polite region so assistive tech announces incoming messages; the
// composer is a labeled form — Enter sends, Shift+Enter inserts a newline.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ArrowLeft, SendHorizontal } from 'lucide-react'

import { Avatar, AvatarFallback } from '@agentic-toolkit/ui/components/avatar'
import { Button } from '@agentic-toolkit/ui/components/button'
import { Spinner } from '@agentic-toolkit/ui/components/spinner'
import { Textarea } from '@agentic-toolkit/ui/components/textarea'
import { TooltipProvider } from '@agentic-toolkit/ui/components/tooltip'

import { useDmThread, type DmMessage } from '../hooks/use-dms'
import { PresenceDot } from './presence-dot'
import { cx, initialsOf } from './util'

/** Short clock time ("14:05") for a message, localized. */
function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({
  message,
  own,
  senderName,
}: {
  message: DmMessage
  own: boolean
  senderName: string
}) {
  const clock = formatClock(message.dateSent)
  return (
    <li className={cx('flex flex-col', own ? 'items-end' : 'items-start')}>
      <div
        className={cx(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words',
          own
            ? 'bg-apt-blue/15 text-apt-text rounded-br-sm'
            : 'bg-apt-surface-2 text-apt-text rounded-bl-sm',
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
      <p className="mt-1 px-1 text-[0.65rem] text-apt-text-dim">
        <span className="sr-only">{own ? 'You' : senderName}, </span>
        {clock && (
          <time dateTime={message.dateSent} title={new Date(message.dateSent).toLocaleString()}>
            {clock}
          </time>
        )}
      </p>
    </li>
  )
}

export function DmThread({
  chatId,
  otherUserId,
  online = false,
  lastSeenAt = null,
  onBack,
  className,
}: {
  chatId: string | null
  /** The other participant's id/handle — used for the header + sender labels. */
  otherUserId?: string
  online?: boolean
  lastSeenAt?: string | null
  /** When provided, a back affordance appears (narrow single-pane layouts). */
  onBack?: () => void
  className?: string
}) {
  const { messages, loading, error, send, markRead, isOwn } = useDmThread(chatId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastSeq = messages.at(-1)?.seq ?? 0

  // Auto-scroll to the newest message after each render that changed the log.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastSeq, loading])

  // Mark the thread read when it's open and the newest message changes (viewing /
  // incoming), and again whenever the window regains focus. markRead defaults to
  // the latest message, so repeat calls are harmless.
  useEffect(() => {
    if (!chatId || messages.length === 0) return
    void markRead()
    const onFocus = () => void markRead()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [chatId, lastSeq, messages.length, markRead])

  // A new thread clears any stale draft error/sending state.
  useEffect(() => {
    setSendError(null)
    setSending(false)
  }, [chatId])

  const submit = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    try {
      await send(text)
      setDraft('')
    } catch (err) {
      // The backend answers 403 when a block/dial now denies contact.
      const forbidden =
        err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 403
      setSendError(
        forbidden
          ? "You can't message this person."
          : err instanceof Error
            ? err.message
            : 'Failed to send message.',
      )
    } finally {
      setSending(false)
    }
  }, [draft, sending, send])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter inserts a newline.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit()
      }
    },
    [submit],
  )

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      void submit()
    },
    [submit],
  )

  if (!chatId) {
    return (
      <div
        className={cx('flex min-h-0 flex-1 items-center justify-center p-6 text-center', className)}
      >
        <p className="text-sm text-apt-text-muted">Select a conversation to start messaging.</p>
      </div>
    )
  }

  const heading = otherUserId ?? 'Conversation'

  return (
    <TooltipProvider>
      <section
        className={cx('flex min-h-0 flex-1 flex-col', className)}
        aria-label={`Conversation with ${heading}`}
      >
        {/* Header: who you're talking to + their presence. */}
        <header className="flex items-center gap-3 border-b border-apt-border px-4 py-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label="Back to conversations"
              className="md:hidden"
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          )}
          {otherUserId && (
            <Avatar className="size-8 shrink-0">
              <AvatarFallback>{initialsOf(otherUserId)}</AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-apt-text">{heading}</p>
            <span className="flex items-center gap-1.5 text-xs text-apt-text-muted">
              <PresenceDot online={online} lastSeenAt={lastSeenAt} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>

        {/* The message log. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-apt-text-muted">
              <Spinner />
              <span>Loading messages…</span>
            </div>
          ) : error ? (
            <p role="alert" className="py-6 text-sm text-apt-red">
              {error}
            </p>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-apt-text-muted">
              No messages yet. Say hello!
            </p>
          ) : (
            <ul role="log" aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={isOwn(message)}
                  senderName={heading}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Composer. */}
        <form
          onSubmit={onSubmit}
          className="flex items-end gap-2 border-t border-apt-border px-4 py-3"
        >
          <label htmlFor="dm-composer" className="sr-only">
            Message {heading}
          </label>
          <Textarea
            id="dm-composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            rows={1}
            disabled={sending}
            className="max-h-32 min-h-9 flex-1 resize-none"
            aria-label={`Message ${heading}`}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
          >
            {sending ? <Spinner className="text-current" /> : <SendHorizontal aria-hidden="true" />}
          </Button>
        </form>
        {sendError && (
          <p role="alert" className="border-t border-apt-border px-4 py-2 text-xs text-apt-red">
            {sendError}
          </p>
        )}
      </section>
    </TooltipProvider>
  )
}
