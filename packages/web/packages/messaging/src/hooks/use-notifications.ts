'use client'

// Client hooks for the unified in-app notification store (messaging P5).
// Backend contract (served under the site's /api proxy → backend, no /api prefix
// on the backend itself):
//   GET  /notifications/unread-count → { count }
//   GET  /notifications              → { items, total, page, pageSize }
//   GET  /notifications/stream       → SSE; emits payload-less `notification` wake
//                                      events (falls back to a single `ready`).
//   POST /notifications/:id/read | /unread | /archive | /trash → { success }
//   POST /notifications/read-all                               → { success }
// The authed JSON client attaches the Bearer token + refresh waterfall. SSE can't
// set headers, so the raw access token rides the query string.

import { useCallback, useEffect, useState } from 'react'
import { authedJson, authedRequest } from '@agentic-toolkit/auth/client'

import { connectSse, type SseHandle } from '@agentic-toolkit/data/stream'

/** Same-origin base — the Next BFF proxy rewrites `/api/*` onto the backend. */
const API_BASE = '/api/notifications'

// --- Shared wake channel ------------------------------------------------------
// Every mounted messaging hook (the header bell's unread count, the inbox, the DM
// list) needs to refetch on the same two triggers: a server-pushed notification, and
// a local mutation (mark read, archive, sent/read a DM — which never comes back over
// the server stream, since that only carries what the server pushes *to* this user).
//
// Both fan out through ONE module-level subscriber set, and — crucially — ONE shared
// `/notifications/stream` EventSource, refcounted: opened on the first subscriber,
// closed on the last. Previously each subscribeToNotifications call opened its own
// stream, so a page with the bell + DM list (+ open inbox) held 2–3 duplicate wake
// connections. Now it holds one.
const subscribers = new Set<() => void>()
let sharedStream: SseHandle | null = null

/** Fan a wake out to every mounted messaging hook. */
function notifyAll(): void {
  for (const listener of subscribers) listener()
}

/**
 * Broadcast that the local user changed messaging state (marked read, archived,
 * sent/read a DM, …). Every mounted messaging hook — the inbox, the header bell,
 * and the DM list — refetches. Exported so the DM hooks (use-dms) share this one
 * authoritative signal rather than standing up a parallel channel.
 */
export function emitLocalChange(): void {
  notifyAll()
}

/**
 * Subscribe `onSignal` to every reason the notification UI should refetch: a local
 * mutation (always), plus the server wake — carried on the single shared
 * `/notifications/stream` (SSE with a token-in-query, or its interval + window-focus
 * poll fallback, both owned by connectSse). The stream is opened on the first
 * subscriber and closed when the last unsubscribes. Returns that unsubscribe.
 */
export function subscribeToNotifications(onSignal: () => void): () => void {
  subscribers.add(onSignal)
  // Open the ONE shared wake stream on the first subscriber (refcounted). The wake
  // payload is ignored — a `notification` event is a signal to refetch, not the row.
  if (!sharedStream && typeof window !== 'undefined') {
    sharedStream = connectSse({
      url: `${API_BASE}/stream`,
      event: 'notification',
      onEvent: notifyAll,
      onPoll: notifyAll,
    })
  }

  return () => {
    subscribers.delete(onSignal)
    // Tear the shared stream down once nobody is listening; the next subscriber reopens it.
    if (subscribers.size === 0 && sharedStream) {
      sharedStream.close()
      sharedStream = null
    }
  }
}

/** A single notification row, as returned by `GET /notifications` (`items[]`). */
export interface Notification {
  id: string
  ecosystemId: string
  userId: string
  /** Who triggered it; null = a system notification (no actor). */
  actorId: string | null
  category: string
  /** Optional polymorphic subject reference (e.g. 'discussion.topic'). */
  entityKind: string | null
  entityId: string | null
  title: string
  body: string | null
  data: Record<string, unknown>
  status: 'inbox' | 'archived' | 'trashed'
  isRead: boolean
  dedupeKey: string | null
  createdAt: string
  updatedAt: string
  readAt: string | null
}

/** The three mailbox statuses a notification can occupy. */
export type NotificationStatus = 'inbox' | 'archived' | 'trashed'

/** Shape of the `GET /notifications` inbox response. */
export interface InboxResponse {
  items: Notification[]
  total: number
  page: number
  pageSize: number
}

/** Query filters for {@link useInbox}. `categories` is a UNION on the backend. */
export interface InboxParams {
  status?: NotificationStatus
  /** Repeated `?category=` params; the backend returns the UNION of these. */
  categories?: string[]
  read?: boolean
  page?: number
  pageSize?: number
}

/** Serialize {@link InboxParams} to a stable query string (empty → ''). */
function buildInboxQuery(params: InboxParams): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.read !== undefined) sp.set('read', String(params.read))
  if (params.page !== undefined) sp.set('page', String(params.page))
  if (params.pageSize !== undefined) sp.set('pageSize', String(params.pageSize))
  for (const c of params.categories ?? []) sp.append('category', c)
  return sp.toString()
}

/**
 * Live unread-notification count for the header bell.
 *
 * Fetches `/notifications/unread-count` immediately, then keeps it fresh via the
 * shared subscription (SSE wake, or poll + focus) plus the local change channel
 * so an in-app mark-read updates the badge at once. A failed refetch keeps the
 * last known count (a transient blip must not flash the badge to 0).
 */
export function useUnreadCount(): { count: number; refetch: () => void } {
  const [count, setCount] = useState(0)

  const refetch = useCallback(() => {
    authedJson<{ count: number }>(`${API_BASE}/unread-count`)
      .then((res) => setCount(res.count))
      .catch(() => {
        /* keep the last known count on a transient failure */
      })
  }, [])

  useEffect(() => {
    refetch()
    return subscribeToNotifications(refetch)
  }, [refetch])

  return { count, refetch }
}

/** The inbox list plus its per-row + bulk mutations. */
export interface UseInboxResult {
  items: Notification[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
  markRead: (id: string) => Promise<void>
  markUnread: (id: string) => Promise<void>
  archive: (id: string) => Promise<void>
  trash: (id: string) => Promise<void>
  readAll: () => Promise<void>
}

/**
 * The notification inbox list. Fetches `/notifications` with the given filters
 * (defaults to the caller's `inbox`), exposing loading / error / items / total,
 * a `refetch`, and the mutation helpers. A stale in-flight request is ignored if
 * params change or the caller unmounts before it resolves, so the last write
 * always reflects the latest query. Each mutation POSTs then fires the shared
 * change signal, which refetches both this list and the header unread count.
 */
export function useInbox(params: InboxParams = {}): UseInboxResult {
  const [items, setItems] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const refetch = useCallback(() => setReloadNonce((n) => n + 1), [])
  const query = buildInboxQuery(params)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    authedJson<InboxResponse>(`${API_BASE}${query ? `?${query}` : ''}`)
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load notifications')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, reloadNonce])

  // Refetch on any wake signal: SSE / poll+focus, plus in-app mutations.
  useEffect(() => subscribeToNotifications(refetch), [refetch])

  // POST an action, then broadcast so this list AND the unread count refetch. A
  // failed action leaves the view untouched (the server didn't change) — correct
  // rather than optimistic; the row simply stays as it was.
  const mutate = useCallback(async (path: string) => {
    await authedRequest(`${API_BASE}${path}`, { method: 'POST' })
    emitLocalChange()
  }, [])

  const markRead = useCallback(
    (id: string) => mutate(`/${encodeURIComponent(id)}/read`),
    [mutate],
  )
  const markUnread = useCallback(
    (id: string) => mutate(`/${encodeURIComponent(id)}/unread`),
    [mutate],
  )
  const archive = useCallback(
    (id: string) => mutate(`/${encodeURIComponent(id)}/archive`),
    [mutate],
  )
  const trash = useCallback(
    (id: string) => mutate(`/${encodeURIComponent(id)}/trash`),
    [mutate],
  )
  const readAll = useCallback(() => mutate('/read-all'), [mutate])

  return { items, total, loading, error, refetch, markRead, markUnread, archive, trash, readAll }
}
