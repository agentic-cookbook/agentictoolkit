'use client'

import {
  EVENT_HTTP_REQUEST,
  captureEvent,
  consumeRetriedFlag,
  scrubPath,
  type EventProps,
} from './analytics'

// A single wrapper around window.fetch times EVERY browser request — authenticated and
// unauthenticated alike — so we get one real-user latency dataset with no per-call-site
// wiring. It is strictly observational: it never reads request/response bodies, never
// changes arguments, and any internal failure falls back to the untouched fetch.

let installed = false
let coldUsed = false // first fetch since page load → the `cold` flag

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Build a predicate flagging requests to our OWN telemetry ingestion (PostHog /
 *  GlitchTip), so the wrapper never recursively captures its own beacons. Handles both
 *  an absolute `api_host` AND a same-origin reverse-proxy path (e.g. `/ingest`, a common
 *  ad-blocker-dodge) — a relative host that `new URL(host)` alone would drop. */
function buildTelemetrySkip(): (url: string) => boolean {
  const hosts = new Set<string>()
  let posthogPathPrefix: string | null = null
  const phRaw = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
  try {
    const ph = new URL(phRaw, window.location.href)
    if (/^https?:\/\//i.test(phRaw)) {
      // Absolute api_host → skip by host.
      hosts.add(ph.host)
    } else if (ph.pathname.length > 1) {
      // Relative host (e.g. "/ingest") is a same-origin reverse proxy → skip by path
      // prefix ONLY (adding its resolved host would be this origin, skipping everything).
      // Strip a trailing slash so the boundary check below is exact.
      posthogPathPrefix = ph.pathname.replace(/\/$/, '')
    }
  } catch {
    /* unparseable — ignore */
  }
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN
  if (dsn) {
    try {
      hosts.add(new URL(dsn).host)
    } catch {
      /* not a URL — ignore */
    }
  }
  return (url: string): boolean => {
    try {
      const u = new URL(url, window.location.href)
      if (hosts.has(u.host)) return true
      if (
        posthogPathPrefix &&
        u.host === window.location.host &&
        (u.pathname === posthogPathPrefix || u.pathname.startsWith(`${posthogPathPrefix}/`))
      ) {
        return true
      }
    } catch {
      /* relative/opaque — don't skip */
    }
    return false
  }
}

interface ServerTimingMetric {
  dur?: number
  desc?: string
}

/** Parse `Server-Timing: app;dur=12.3, db;dur=4.5;desc="3"` → { app:{dur}, db:{dur,desc} }.
 *  Malformed `dur` (`.`, `1.2.3`) is dropped rather than emitted as NaN. */
function parseServerTiming(header: string | null): Record<string, ServerTimingMetric> {
  const out: Record<string, ServerTimingMetric> = {}
  if (!header) return out
  for (const part of header.split(',')) {
    const seg = part.trim()
    const name = seg.split(';')[0]?.trim()
    if (!name) continue
    const metric: ServerTimingMetric = out[name] ?? (out[name] = {})
    const dur = seg.match(/dur=([^;,]+)/)
    if (dur) {
      const v = Number(dur[1]?.trim())
      if (Number.isFinite(v)) metric.dur = v
    }
    const desc = seg.match(/desc="([^"]*)"/)
    if (desc) metric.desc = desc[1]
  }
  return out
}

function hasAuthHeader(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (typeof Request !== 'undefined' && input instanceof Request && input.headers.has('authorization')) {
    return true
  }
  const h = init?.headers
  if (!h) return false
  if (typeof Headers !== 'undefined' && h instanceof Headers) return h.has('authorization')
  if (Array.isArray(h)) return h.some(([k]) => String(k).toLowerCase() === 'authorization')
  return Object.keys(h as Record<string, string>).some((k) => k.toLowerCase() === 'authorization')
}

interface RecordInput {
  url: string
  method: string
  status: number
  ok: boolean
  start: number
  authenticated: boolean
  retried: boolean
  cold: boolean
  res?: Response
}

function record(o: RecordInput): void {
  try {
    const props: EventProps = {
      path: scrubPath(o.url),
      method: o.method,
      status: o.status,
      ok: o.ok,
      duration_ms: Math.round(performance.now() - o.start),
      cold: o.cold,
      authenticated: o.authenticated,
      retried: o.retried,
    }
    if (o.res) {
      const st = parseServerTiming(o.res.headers.get('Server-Timing'))
      if (st.app?.dur != null) props.server_ms = round1(st.app.dur)
      if (st.db?.dur != null) props.db_ms = round1(st.db.dur)
      const count = st.db?.desc != null ? Number(st.db.desc) : NaN
      if (Number.isFinite(count)) props.db_count = count
    }
    captureEvent(EVENT_HTTP_REQUEST, props)
  } catch {
    /* never break the fetch over a metric */
  }
}

/**
 * Patch `window.fetch` once to emit an `http_request` event per call. Idempotent and
 * browser-only; requests to telemetry-ingestion hosts are skipped. Safe to call from a
 * React effect on every site that mounts the shared chrome.
 */
export function instrumentFetch(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true

  const original = window.fetch.bind(window)
  const skip = buildTelemetrySkip()

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: string
    let method: string
    try {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        url = input.url
        method = (init?.method ?? input.method ?? 'GET').toUpperCase()
      } else {
        url = typeof input === 'string' ? input : String(input)
        method = (init?.method ?? 'GET').toUpperCase()
      }
    } catch {
      return original(input as RequestInfo, init)
    }

    if (skip(url)) return original(input as RequestInfo, init)

    const authenticated = safe(() => hasAuthHeader(input, init), false)
    // The marker is normally on `init` (authedFetch's path), but also honor a marked
    // Request object so a future `fetch(new Request(url, init))` caller is tagged too.
    const retried =
      consumeRetriedFlag(init) ||
      (typeof Request !== 'undefined' && input instanceof Request ? consumeRetriedFlag(input) : false)
    const cold = !coldUsed
    coldUsed = true
    const start = performance.now()

    try {
      const res = await original(input as RequestInfo, init)
      record({ url, method, status: res.status, ok: res.ok, start, authenticated, retried, cold, res })
      return res
    } catch (err) {
      record({ url, method, status: 0, ok: false, start, authenticated, retried, cold })
      throw err
    }
  }
}
