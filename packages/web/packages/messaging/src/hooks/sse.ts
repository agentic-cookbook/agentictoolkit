'use client'

// The shared SSE transport for the messaging hooks. Both the notification wake stream
// (use-notifications) and the per-thread DM stream (use-dms) share this: read the
// access token (EventSource can't set an Authorization header, so it rides the query
// string), open the stream, listen for one event, and fall back to an interval +
// window-focus poll when there's no live channel.
//
// It is SELF-HEALING: the poll fallback keeps trying to (re)open SSE with a freshly
// read token, so it recovers from BOTH (a) a first mount that happens before the token
// is written (post-login) — the old per-hook code latched onto polling for the session
// — and (b) an access token that expires mid-session (the reconnect 401s → CLOSED →
// poll → a poll tick refreshes the token and re-opens live SSE). Each hook supplies
// only its url, event name, payload handler and poll action (SRP).

import { readAccessToken } from '@agentic-toolkit/auth/client'

/** Default poll cadence (ms) for the SSE fallback — one place, both hooks. */
export const DEFAULT_SSE_POLL_INTERVAL_MS = 20_000

/** A live SSE connection (or its poll fallback); `close()` tears down everything. */
export interface SseHandle {
  close(): void
}

export interface ConnectSseOptions {
  /** Stream URL WITHOUT the token — the helper appends `?access_token=` / `&access_token=`. */
  url: string
  /** The SSE event name to listen for (e.g. 'message', 'notification'). */
  event: string
  /** Called with each event's raw `data` string; the caller parses as needed. */
  onEvent: (data: string) => void
  /** Fallback action, run on an interval + on window focus while polling. */
  onPoll: () => void
  /** Fallback poll cadence (ms); defaults to {@link DEFAULT_SSE_POLL_INTERVAL_MS}. */
  pollIntervalMs?: number
}

/**
 * Open a token-in-query SSE stream listening for `event`, with a self-healing poll
 * fallback. Returns a handle whose `close()` removes the listener, clears the poll
 * timer/focus handler and closes the stream. A no-op on the server (no `window`).
 */
export function connectSse(opts: ConnectSseOptions): SseHandle {
  if (typeof window === 'undefined') return { close() {} }
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_SSE_POLL_INTERVAL_MS

  let closed = false
  let source: EventSource | null = null
  let pollTimer: number | null = null
  let focusHandler: (() => void) | null = null

  const handler = (event: Event) => opts.onEvent((event as MessageEvent).data)

  const stopPolling = () => {
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
    if (focusHandler) {
      window.removeEventListener('focus', focusHandler)
      focusHandler = null
    }
  }

  // Try to open the live stream with the CURRENT token; returns whether one is now open.
  // Reading the token fresh each attempt is what makes reconnect-after-expiry and
  // open-after-late-login both work.
  const openSse = (): boolean => {
    if (closed || source) return source != null
    if (!('EventSource' in window)) return false
    const token = readAccessToken()
    if (!token) return false
    const sep = opts.url.includes('?') ? '&' : '?'
    const s = new EventSource(`${opts.url}${sep}access_token=${encodeURIComponent(token)}`)
    s.addEventListener(opts.event, handler)
    // Only a permanent close (CLOSED) triggers the fallback — e.g. a 401 on reconnect
    // once the token expired. A transient blip (CONNECTING) is left to the browser's
    // own auto-reconnect. On a hard close, drop to polling; a poll tick will re-open.
    s.onerror = () => {
      if (s.readyState !== EventSource.CLOSED) return
      s.removeEventListener(opts.event, handler)
      s.onerror = null
      s.close()
      if (source === s) source = null
      startPolling()
    }
    source = s
    return true
  }

  const startPolling = () => {
    if (closed || pollTimer != null) return
    focusHandler = opts.onPoll
    window.addEventListener('focus', focusHandler)
    pollTimer = window.setInterval(() => {
      opts.onPoll()
      // The poll (authedJson) refreshes the token; try to upgrade back to live SSE.
      if (!source && openSse()) stopPolling()
    }, pollIntervalMs)
  }

  // Prefer live SSE; poll when there's no token / EventSource yet (a poll tick retries).
  if (!openSse()) startPolling()

  return {
    close() {
      closed = true
      if (source) {
        source.removeEventListener(opts.event, handler)
        source.onerror = null
        source.close()
        source = null
      }
      stopPolling()
    },
  }
}
