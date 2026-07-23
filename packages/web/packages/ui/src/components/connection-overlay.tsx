"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

const mono = "var(--mono,ui-monospace,monospace)"

// All colors are the shared ADH theme tokens (var(--color-apt-*)) so this component
// is app-agnostic — it carries no app-local palette and tracks whatever theme the
// consuming app loads.
const BG = "var(--color-apt-bg)"
const SURFACE = "var(--color-apt-surface)"
const BORDER = "var(--color-apt-border)"
const TEXT = "var(--color-apt-text)"
const MUTED = "var(--color-apt-text-muted)"
const DIM = "var(--color-apt-text-dim)"
const BLUE = "var(--color-apt-blue)"

/** Don't flash the overlay on a momentary blip — only surface once the feed has
 *  been dark this long. Hidden instantly on recovery. */
const SHOW_DELAY_MS = 1_200
/** Auto-retry cadence (and the visible countdown). Independent of any store's own
 *  poll clock so the number always counts cleanly down to a real retry. */
const RETRY_SECONDS = 15
/** Under this age we call the outage a (re)deploy — the calm, expected case; beyond
 *  it we stop implying a deploy and say plainly it's down. */
const DEPLOY_GRACE_MS = 90_000

export interface ConnectionOverlayProps {
  /** True while the live feed is dark (unreachable) on an Overview/Details board. */
  active: boolean
  /** Kick an immediate reconnect/re-read (the "try again now" action + auto-retry). */
  onRetry: () => void
  /** Last error text, shown small once we've stopped calling it a deploy. */
  detail?: string | null
}

/**
 * A modal card shown OVER the current board (Overview/Details) when a live feed goes
 * dark — instead of tearing the panels down and showing an alarming "offline" error
 * or freezing on stale content. A backend redeploy drops the stream and fails the
 * poll; that is expected and brief, so this presents it calmly: a spinner, a "Backend
 * deploying" heading (escalating to "unreachable" only once the outage outlasts a
 * normal deploy), a countdown to the next automatic retry, and a "Try again now"
 * button. It obscures — never rearranges — what's underneath.
 *
 * Shared by the status and builder dashboards (vendored via @agentic-toolkit/ui).
 */
export function ConnectionOverlay({ active, onRetry, detail }: ConnectionOverlayProps) {
  const [shown, setShown] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [countdown, setCountdown] = useState(RETRY_SECONDS)
  const sinceRef = useRef<number | null>(null)
  // The countdown's source of truth lives in a ref so the auto-retry side effect can
  // fire from the interval body, never from inside a setState updater (which React may
  // run twice under StrictMode/concurrent, double-firing onRetry).
  const remainingRef = useRef(RETRY_SECONDS)
  // Keep the latest onRetry in a ref so the tick effect below need not list it as a
  // dependency: a consumer that passes an inline callback (a new identity every
  // render) would otherwise re-run the effect and reset the countdown on each parent
  // re-render, so the 15s auto-retry would never actually fire.
  const onRetryRef = useRef(onRetry)
  onRetryRef.current = onRetry

  // Debounced show: surface only after the feed has stayed dark past a blip; hide
  // immediately when the connection recovers (active → false).
  useEffect(() => {
    if (!active) {
      setShown(false)
      sinceRef.current = null
      setElapsedMs(0)
      return
    }
    const t = setTimeout(() => {
      sinceRef.current = Date.now()
      setShown(true)
    }, SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [active])

  // While shown, tick once a second: advance the outage clock and the retry
  // countdown; on reaching zero, auto-retry and reset.
  useEffect(() => {
    if (!shown) return
    remainingRef.current = RETRY_SECONDS
    setCountdown(RETRY_SECONDS)
    const id = setInterval(() => {
      if (sinceRef.current != null) setElapsedMs(Date.now() - sinceRef.current)
      const next = remainingRef.current - 1
      if (next <= 0) {
        remainingRef.current = RETRY_SECONDS
        setCountdown(RETRY_SECONDS)
        onRetryRef.current()
      } else {
        remainingRef.current = next
        setCountdown(next)
      }
    }, 1_000)
    return () => clearInterval(id)
  }, [shown])

  if (!shown) return null

  const deploying = elapsedMs < DEPLOY_GRACE_MS
  const heading = deploying ? "Backend deploying" : "Backend unreachable"
  const sub = deploying
    ? "The backend is restarting — reconnecting automatically. This usually takes a moment."
    : "Still can't reach the backend. Retrying automatically."

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        // Near-opaque so it OBSCURES the panels beneath rather than layering over
        // readable content — the point is to hide, not decorate.
        background: `color-mix(in srgb, ${BG} 90%, transparent)`,
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        fontFamily: mono,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 13,
          maxWidth: "46ch",
          textAlign: "center",
          padding: "28px 34px",
          borderRadius: 12,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          color: TEXT,
        }}
      >
        <Loader2 className="animate-spin" size={34} color={BLUE} aria-hidden />
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em" }}>{heading}</div>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{sub}</div>
        {/* aria-hidden: the parent is an aria-live region, so a per-second countdown
            would spam a screen reader; the heading/sub already announce the state. */}
        <div aria-hidden style={{ fontSize: 11.5, color: DIM }}>
          Retrying in {countdown}s
        </div>
        <button
          type="button"
          onClick={() => {
            remainingRef.current = RETRY_SECONDS
            setCountdown(RETRY_SECONDS)
            onRetry()
          }}
          style={{
            appearance: "none",
            cursor: "pointer",
            marginTop: 2,
            padding: "7px 18px",
            borderRadius: 8,
            background: BLUE,
            color: "white",
            border: "none",
            fontFamily: mono,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          Try again now
        </button>
        {detail && !deploying && (
          <div style={{ fontSize: 10.5, color: DIM, opacity: 0.75, wordBreak: "break-word" }}>{detail}</div>
        )}
      </div>
    </div>
  )
}
