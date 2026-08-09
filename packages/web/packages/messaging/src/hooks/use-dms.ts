'use client'

// Client hooks for 1:1 direct messages (messaging P5, consuming the P3 chat.*
// DM backend). Every request rides the same-origin Next BFF proxy (`/api/*` →
// backend, which has no `/api` prefix of its own), so the authed JSON client can
// attach the Bearer token + refresh waterfall. SSE can't set headers, so the live
// thread stream carries the raw access token in the query string — mirroring the
// notifications hook.
//
// Backend contract (all participant-scoped; src/routes/chat.ts):
//   GET  /chat/dms                        → { chats: DmChatSummary[] }
//   POST /chat/dms { recipientId }        → { id, otherUserId, created }; 403 when
//                                           canContact denies (blocked / dial)
//   GET  /chat/dms/:id/messages?page&pageSize → { items, total, page, pageSize }
//   POST /chat/dms/:id/messages { body, clientMessageId? } → the sent message
//   POST /chat/dms/:id/read { messageId? }               → { success, unreadCount }
//   GET  /chat/dms/:id/stream?after=<seq>&access_token=<jwt> → SSE `message` events
//   GET  /presence?userIds=a,b            → { presence: PresenceView[] }

import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthHttpError, authedJson, authedRequest } from '@agentic-toolkit/auth/client'
import { useAuth } from '@agentic-toolkit/auth'

import { connectSse, type SseHandle } from '@agentic-toolkit/data/stream'
import { emitLocalChange, subscribeToNotifications } from './use-notifications'

/** Same-origin bases — the Next BFF proxy rewrites `/api/*` onto the backend. */
const DM_BASE = '/api/chat/dms'
const PRESENCE_BASE = '/api/presence'

// --- wire types (mirror the backend DTOs) ------------------------------------

/** One direct message, oldest-first within a thread. `senderUserId` is the exact
 *  user id behind the sender (resolved server-side from `senderParticipantId`), so
 *  ownership is an exact `senderUserId === callerId` compare — see {@link useDmThread}. */
export interface DmMessage {
  id: string
  chatId: string
  senderParticipantId: string | null
  /** The user id of the sender. Empty string only if the sender row is missing. */
  senderUserId: string
  seq: number
  role: string
  body: string
  state: string
  dateSent: string
}

/** The last message of a DM chat, shown as the list preview. */
export interface DmMessagePreview {
  id: string
  senderParticipantId: string | null
  body: string
  seq: number
  dateSent: string
}

/** One row of the caller's DM inbox (`GET /chat/dms`). */
export interface DmChatSummary {
  chatId: string
  otherUserId: string
  lastMessage: DmMessagePreview | null
  unreadCount: number
}

/** Live presence for a user (`GET /presence`). Server-gated: a hidden or absent
 *  target reports `{ online: false, lastSeenAt: null }`, so real state never leaks. */
export interface PresenceView {
  userId: string
  online: boolean
  lastSeenAt: string | null
}

/** A DM inbox row with its other participant's presence merged in. */
export interface DmConversation extends DmChatSummary {
  online: boolean
  lastSeenAt: string | null
}

// --- conversation list -------------------------------------------------------

export interface UseDmConversationsResult {
  chats: DmConversation[]
  loading: boolean
  error: string | null
  refetch: () => void
  /** True when more conversations exist beyond the loaded set. */
  hasMore: boolean
  /** Load the next page of conversations and append it. */
  loadMore: () => void
  /** True while a loadMore() is in flight (the initial load uses `loading`). */
  loadingMore: boolean
}

/** Fetch presence for a set of user ids → a `userId → view` map (best-effort: a
 *  failed presence read must not blank the conversation list, so it resolves to an
 *  empty map and rows fall back to offline). */
async function fetchPresenceMap(userIds: string[]): Promise<Map<string, PresenceView>> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  try {
    const res = await authedJson<{ presence: PresenceView[] }>(
      `${PRESENCE_BASE}?userIds=${encodeURIComponent(ids.join(','))}`,
    )
    return new Map(res.presence.map((view) => [view.userId, view]))
  } catch {
    return new Map()
  }
}

/** DM inbox window: the initial size, the step per "Load more", and the ceiling the
 *  backend also caps at. The client grows ONE window (a single `pageSize` request)
 *  rather than accumulating offset pages, so each fetch is one consistent snapshot —
 *  no cross-page drop/duplicate as chats reorder on `updated_at`. */
const DM_PAGE_SIZE = 100
const DM_MAX_LIMIT = 500

/**
 * The caller's DM inbox: DM chats newest-updated first, each carrying the other
 * participant's presence (`online` / `lastSeenAt`). One growing window: the first
 * DM_PAGE_SIZE load on mount; `loadMore` widens it by DM_PAGE_SIZE (up to
 * DM_MAX_LIMIT) in a single request. Refetches the current window on the shared
 * messaging wake channel — the notifications SSE (a new DM pushes a `direct_message`
 * wake), window focus, and any in-app change (a send/read broadcast) — in ONE request,
 * so the list stays live without its own poll. A failed refetch keeps the last good
 * list (a transient blip must not flash the inbox empty).
 */
export function useDmConversations(): UseDmConversationsResult {
  const [chats, setChats] = useState<DmConversation[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(DM_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guard against a slow response overwriting a newer one, and against a resolve
  // after unmount. Bumped on every load; only the latest generation may commit.
  const generation = useRef(0)

  // Load ONE window of `size` conversations (a single snapshot), merge each row's
  // presence, commit. The one authoritative loader — mount, wake-refetch and load-more
  // all route through it.
  const load = useCallback(async (size: number) => {
    const gen = ++generation.current
    try {
      const res = await authedJson<{ chats: DmChatSummary[]; total?: number }>(
        `${DM_BASE}?pageSize=${size}`,
      )
      const presence = await fetchPresenceMap(res.chats.map((chat) => chat.otherUserId))
      if (gen !== generation.current) return
      setChats(
        res.chats.map((chat) => {
          const view = presence.get(chat.otherUserId)
          return { ...chat, online: view?.online ?? false, lastSeenAt: view?.lastSeenAt ?? null }
        }),
      )
      setTotal(res.total ?? res.chats.length)
      setError(null)
      setLoading(false)
      setLoadingMore(false)
    } catch (err) {
      if (gen !== generation.current) return
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // (Re)load whenever the window grows (mount + each loadMore).
  useEffect(() => {
    void load(limit)
    // On change/unmount, invalidate any in-flight load so it can't commit late.
    return () => {
      generation.current++
    }
  }, [load, limit])

  // Refetch the current window on any wake — ONE request (the closure reads the live
  // `limit`; a grow re-subscribes, a cheap Set swap on the shared wake channel).
  const refetch = useCallback(() => void load(limit), [load, limit])
  useEffect(() => subscribeToNotifications(refetch), [refetch])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setLimit((n) => Math.min(n + DM_PAGE_SIZE, DM_MAX_LIMIT))
  }, [])

  // More exist only if the server reports more AND the window hasn't hit its ceiling
  // (a single snapshot means chats.length is exact — no dedup-vs-total skew).
  const hasMore = chats.length < total && limit < DM_MAX_LIMIT
  return { chats, loading, error, refetch, hasMore, loadMore, loadingMore }
}

// --- a single thread ---------------------------------------------------------

export interface UseDmThreadResult {
  messages: DmMessage[]
  loading: boolean
  error: string | null
  /** Send `body`; appends the persisted message. Throws on failure (incl. a 403
   *  when a block/dial now denies contact) so the composer can surface it inline. */
  send: (body: string) => Promise<void>
  /** Mark the thread read (defaults to the latest message), then broadcast so the
   *  conversation list's unread badge clears. */
  markRead: () => Promise<void>
  /** True when `msg` was sent by the local user (right-aligned in the thread). */
  isOwn: (msg: DmMessage) => boolean
}

/** Merge one message into the list, keeping seq order and deduping by id (the SSE
 *  stream and the POST response can both deliver the same row). */
function mergeMessage(prev: DmMessage[], incoming: DmMessage): DmMessage[] {
  if (prev.some((m) => m.id === incoming.id)) return prev
  const next = [...prev, incoming]
  next.sort((a, b) => a.seq - b.seq)
  return next
}

/**
 * One DM thread: loads the message history, appends live incoming messages over
 * SSE, and exposes `send` / `markRead`. The stream carries the access token in the
 * query string (EventSource can't set headers) and starts after the newest loaded
 * seq, so it only pushes genuinely new messages; the EventSource is torn down on
 * `chatId` change / unmount.
 *
 * If the stream dies — e.g. the backend 401s the reconnect once the access token
 * expires — we tear it down and downgrade to polling (interval + window focus) so
 * the thread keeps updating instead of silently freezing.
 *
 * Ownership (right/left alignment) is exact: each message carries its `senderUserId`,
 * compared to the signed-in user's id (`callerId`, from the auth context).
 */
export function useDmThread(chatId: string | null): UseDmThreadResult {
  const { user } = useAuth()
  const callerId = user?.id ?? null

  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load history, then open the live stream from the newest loaded seq. Both live
  // in one effect so the stream's `after` cursor is the post-load high-water mark.
  // A dead stream (token expiry, network drop) downgrades to polling.
  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    let connection: SseHandle | null = null
    setLoading(true)
    setError(null)

    const messagesUrl = `${DM_BASE}/${encodeURIComponent(chatId)}/messages?pageSize=200`

    // Merge a freshly-fetched window into the list (dedupe by id, keep seq order).
    const mergeItems = (items: DmMessage[]) => {
      setMessages((prev) => {
        let next = prev
        for (const msg of items) next = mergeMessage(next, msg)
        return next
      })
    }
    // The poll fallback's action (armed inside connectSse when SSE is unavailable or
    // dies): refetch the newest window.
    const refetchThread = () => {
      authedJson<{ items: DmMessage[] }>(messagesUrl)
        .then((res) => {
          if (!cancelled) mergeItems(res.items)
        })
        .catch(() => {
          /* keep the last good thread on a transient failure */
        })
    }

    authedJson<{ items: DmMessage[] }>(messagesUrl)
      .then((res) => {
        if (cancelled) return
        const items = [...res.items].sort((a, b) => a.seq - b.seq)
        // Merge (not replace) so a message the user sent DURING this load — the composer
        // is live while loading — isn't clobbered; mergeMessage dedupes by id + keeps seq
        // order, so re-loading the same history is idempotent.
        setMessages((prev) => {
          let next = prev
          for (const msg of items) next = mergeMessage(next, msg)
          return next
        })
        setLoading(false)

        // Open the live stream from the newest loaded seq (so it only pushes
        // genuinely new messages); connectSse owns the token-in-query, the
        // reconnect-death → poll fallback, and teardown.
        const afterSeq = items.at(-1)?.seq ?? 0
        connection = connectSse({
          url: `${DM_BASE}/${encodeURIComponent(chatId)}/stream?after=${afterSeq}`,
          event: 'message',
          onEvent: (data) => {
            try {
              const msg = JSON.parse(data) as DmMessage
              setMessages((prev) => mergeMessage(prev, msg))
            } catch {
              /* ignore a malformed frame — the next valid one still lands */
            }
          },
          onPoll: refetchThread,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load messages')
        setLoading(false)
      })

    return () => {
      cancelled = true
      connection?.close()
    }
  }, [chatId])

  const send = useCallback(
    async (body: string) => {
      const text = body.trim()
      if (!chatId || !text) return
      const clientMessageId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const msg = await authedJson<DmMessage>(
        `${DM_BASE}/${encodeURIComponent(chatId)}/messages`,
        { method: 'POST', body: JSON.stringify({ body: text, clientMessageId }) },
      )
      setMessages((prev) => mergeMessage(prev, msg))
      // Refresh the conversation list (preview + ordering + unread).
      emitLocalChange()
    },
    [chatId],
  )

  const markRead = useCallback(async () => {
    if (!chatId) return
    // A body is required (the backend rejects empty JSON); `{}` reads to latest.
    await authedRequest(`${DM_BASE}/${encodeURIComponent(chatId)}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    emitLocalChange()
  }, [chatId])

  // Exact ownership: the sender's user id equals the signed-in user's id.
  const isOwn = useCallback(
    (msg: DmMessage) => callerId != null && msg.senderUserId === callerId,
    [callerId],
  )

  return { messages, loading, error, send, markRead, isOwn }
}

// --- starting a DM -----------------------------------------------------------

/** The result of {@link startDm}: the chat id to open, or a forbidden flag when
 *  the recipient can't be contacted (blocked / their dial denies it). */
export type StartDmResult = { chatId: string } | { forbidden: true }

/**
 * Open — or reuse — a DM with `recipientId`. Returns the chat id on success, or
 * `{ forbidden: true }` when the backend answers 403 (canContact denies), so the
 * caller can show a friendly "You can't message this person" instead of crashing.
 * Any other failure throws.
 */
export async function startDm(recipientId: string): Promise<StartDmResult> {
  try {
    const res = await authedJson<{ id: string; otherUserId: string; created: boolean }>(DM_BASE, {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    })
    return { chatId: res.id }
  } catch (err) {
    if (err instanceof AuthHttpError && err.status === 403) return { forbidden: true }
    throw err
  }
}
