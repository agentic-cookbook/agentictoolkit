"use client"

// Embeddable waitlist form. Talks to exactly two public adh endpoints and knows nothing else
// about the platform, so any marketing site can drop it in with a public key and an origin.
//
// The mount GET does double duty: it supplies the list's copy AND the signed nonce the POST
// must present back. That round trip is the anti-abuse gate (see audience/nonce.ts), so the
// form cannot submit before it has loaded — which is also why there is no optimistic path.

import * as React from "react"

import { cn } from "../lib/utils"

export interface EmailSignupFormProps {
  /** The list's public key, from the hub's Embed tab. Safe to ship in public HTML. */
  publicKey: string
  /**
   * Where the two public endpoints live: an absolute origin
   * (`https://api.agenticdeveloperhub.com`) or a same-origin path prefix (`/api`) for a host
   * that already proxies the backend. Either way, no trailing slash.
   */
  apiBaseUrl: string
  /** Override the copy the list itself supplies. */
  title?: string
  description?: string
  buttonLabel?: string
  successMessage?: string
  /** Collect a name alongside the address. Default true. */
  collectName?: boolean
  className?: string
}

interface ListConfig {
  name: string
  description: string | null
  status: string
  nonce: string
}

/**
 * The form's outcomes, kept mutually exclusive so the DOM can only ever be telling the visitor
 * one thing. `closed` and `unavailable` are separate on purpose: `closed` means the list loaded
 * and is not accepting signups, `unavailable` means we never got an answer. Collapsing the two
 * would have the form state, on someone else's marketing page, that a perfectly open list is
 * closed whenever the backend happens to be down.
 */
type Phase = "loading" | "ready" | "submitting" | "done" | "closed" | "unavailable"

/**
 * One error slot, never two, so a stale request failure cannot sit underneath a fresh
 * validation message reading as two unrelated problems. The kinds stay tellable apart by what
 * they point AT: `validation` marks the field (aria-invalid), `server` is about the request.
 */
type FormError = { kind: "validation" | "server"; message: string }

/**
 * Same shape recipient-input.tsx validates against. Deliberately loose — the server is the
 * authority on deliverability. This exists to catch the typo that would otherwise spend one of
 * the visitor's ten hourly signups (publicSignup.ts IP_HOURLY_CAP) on a certain rejection.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailSignupForm({
  publicKey,
  apiBaseUrl,
  title,
  description,
  buttonLabel = "Sign up",
  successMessage = "Thanks for signing up! Check your inbox for a confirmation.",
  collectName = true,
  className,
}: EmailSignupFormProps): React.ReactElement {
  const [config, setConfig] = React.useState<ListConfig | null>(null)
  const [phase, setPhase] = React.useState<Phase>("loading")
  const [email, setEmail] = React.useState("")
  const [name, setName] = React.useState("")
  const [honeypot, setHoneypot] = React.useState("")
  const [error, setError] = React.useState<FormError | null>(null)

  // Ids are instance-scoped: a page may embed this form more than once (a hero and a footer
  // CTA), and duplicate ids would point every label at whichever input rendered first.
  const uid = React.useId()
  const nameId = `${uid}-name`
  const emailId = `${uid}-email`
  const errorId = `${uid}-error`

  const base = apiBaseUrl.replace(/\/$/, "")

  /**
   * The list config GET, factored out of the mount effect because a FAILED submit has to run it
   * again. The nonce it carries has a server-side lifetime (audience/nonce.ts MAX_AGE_MS, 30
   * minutes); fetching it once at mount meant a tab left open past that window could never sign
   * up again — every retry re-sent the same expired nonce, and the only cure was a page reload.
   */
  const fetchConfig = React.useCallback(async (): Promise<ListConfig> => {
    const res = await fetch(`${base}/public/signup-lists/${encodeURIComponent(publicKey)}`)
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as ListConfig
  }, [base, publicKey])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const body = await fetchConfig()
        if (cancelled) return
        setConfig(body)
        setPhase(body.status === "open" ? "ready" : "closed")
      } catch {
        if (!cancelled) setPhase("unavailable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchConfig])

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!config || phase !== "ready") return

    // Checked here rather than left to `required`/`type="email"`, because the browser's own
    // constraint UI never fires for a programmatic submit and, more to the point, a bad address
    // costs the visitor one of a small hourly budget for nothing.
    if (!EMAIL_RE.test(email.trim())) {
      setError({ kind: "validation", message: "Enter a valid email address." })
      return
    }

    setPhase("submitting")
    setError(null)
    try {
      const res = await fetch(`${base}/public/signup-lists/${encodeURIComponent(publicKey)}/signups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          nonce: config.nonce,
          website: honeypot,
          sourceUrl: typeof window === "undefined" ? undefined : window.location.href,
        }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setPhase("done")
    } catch {
      // Deliberately generic. The server's reasons ('invalid submission') describe the
      // anti-abuse gate, and repeating them tells an attacker which defence tripped.
      setError({ kind: "server", message: "Something went wrong. Please try again." })
      // Re-enabled FIRST, in the same commit as the error, so the retry affordance never waits
      // on a second network round trip that may itself hang.
      setPhase("ready")
      // ...and then the nonce is replaced, because an EXPIRED nonce is the one failure that
      // retrying with the same payload can never recover from: the server rejects it, we land
      // back here, and without this the next attempt carries the identical dead value forever.
      await refreshConfig()
    }
  }

  /**
   * Swap in a fresh config (and therefore a fresh nonce) after a failed submit.
   *
   * Failure to refresh is deliberately silent and KEEPS the config we already have: the visitor
   * has just been told something went wrong, and a stale nonce still leaves a form they can try
   * again with, whereas surfacing a second error — or dropping to `unavailable` — would take a
   * working form away over a transient blip. A list that has CLOSED while the tab sat open is
   * different: that is a durable answer, and continuing to offer the form would be a lie.
   */
  async function refreshConfig(): Promise<void> {
    try {
      const body = await fetchConfig()
      setConfig(body)
      if (body.status !== "open") setPhase("closed")
    } catch {
      /* keep the config we have — see above */
    }
  }

  if (phase === "loading") {
    return <div className={cn("text-sm opacity-60", className)}>Loading…</div>
  }

  if (phase === "closed") {
    return (
      <div className={cn("text-sm", className)}>
        <p>{config?.name ?? "This list"} is closed to new signups right now.</p>
      </div>
    )
  }

  if (phase === "unavailable") {
    return (
      <div className={cn("text-sm", className)}>
        <p>Signups are unavailable right now. Please try again later.</p>
      </div>
    )
  }

  if (phase === "done") {
    return <SignupDone className={className} message={successMessage} />
  }

  const busy = phase === "submitting"

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-3", className)}>
      <div>
        <h3 className="text-lg font-medium">{title ?? config?.name}</h3>
        {(description ?? config?.description) ? (
          <p className="text-sm opacity-70">{description ?? config?.description}</p>
        ) : null}
      </div>

      {collectName ? (
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border px-3 py-2"
            autoComplete="name"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1 text-sm">
        {/* A real label, not a placeholder: placeholder text vanishes the moment anyone types
            and is not reliably announced, so the field would be unlabelled exactly when it is
            being filled in. */}
        <label htmlFor={emailId}>Email address</label>
        <input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border px-3 py-2"
          autoComplete="email"
          // Rendered in BOTH directions rather than omitted when valid, so the field's state is
          // always readable — by assistive tech and by a test — instead of only its bad half.
          aria-invalid={error?.kind === "validation"}
          aria-describedby={error?.kind === "validation" ? errorId : undefined}
        />
      </div>

      {/* Honeypot. Hidden from sight AND from assistive tech, excluded from tab order, and
          autocomplete off so a password manager never fills it. A human cannot reach it; a
          bot walking the DOM fills it and the server drops the submission silently. */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        // `disabled` alone is visual-plus-semantic but says nothing about WHY. aria-busy is what
        // tells a screen reader the control is working rather than simply unavailable.
        aria-busy={busy}
        className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Signing up…" : buttonLabel}
      </button>

      <p className="text-xs opacity-60">
        We&apos;ll only email you about this. Unsubscribe any time.
      </p>
    </form>
  )
}

/**
 * Success replaces the form outright, which means its live region is mounted in the same commit
 * as its text — a case screen readers routinely miss, because there was no region to observe a
 * change in. Taking focus is what actually delivers the outcome, and it also rescues the focus
 * the submit button took with it when it unmounted.
 */
function SignupDone({ className, message }: { className?: string; message: string }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div ref={ref} role="status" tabIndex={-1} className={cn("text-sm", className)}>
      <p>{message}</p>
    </div>
  )
}
