"use client"

// Embeddable waitlist form. Talks to exactly two public adh endpoints and knows nothing else
// about the platform, so any marketing site can drop it in with a public key and an origin.
//
// The mount GET does double duty: it supplies the list's copy AND the signed nonce the POST
// must present back. That round trip is the anti-abuse gate (see audience/nonce.ts), so the
// form cannot submit before it has loaded — which is also why there is no optimistic path.
//
// CONSUMERS. This component has no consumer inside the adh monorepo and is not supposed to
// acquire one — the hub only ever emits it as a snippet STRING (email-signup/embed-panel.tsx).
// Its real caller is a different repository:
//
//   whatsnow.today — websites/whatsnow/src/app/page.tsx, branch `email-signup`
//
// which mounts it with `apiBaseUrl="/api"` through the Next rewrite in that app's
// next.config.ts. Recorded here because a repo-wide grep makes this file look like dead code,
// and deleting it would silently break that site's only signup path. Anything that changes the
// wire shape (the two URLs, the POST body) is a breaking change for a repo that CI here does
// not build.

import * as React from "react"

import { noAutofillProps } from "../lib/autofill"
import { cn } from "../lib/utils"

export interface EmailSignupFormProps {
  /** The list's public key, from the hub's Embed tab. Safe to ship in public HTML. */
  publicKey: string
  /**
   * Where the two public endpoints live, with no trailing slash. Two shapes are supported, and
   * which one is correct depends on who owns the page — they are not interchangeable:
   *
   * - An absolute origin (`https://api.agenticdeveloperhub.com`) for a page on a site with no
   *   backend of its own. This is what the hub's Embed tab emits, because that snippet is
   *   pasted onto THIRD-PARTY sites where a relative prefix would resolve against — and POST
   *   signups to — whichever domain the paste landed on. The origin must then be on the
   *   backend's CORS allowlist.
   * - A same-origin path prefix (`/api`) for a site that already proxies the backend, which is
   *   what whatsnow.today does. Nothing is cross-origin, so no CORS entry is needed; the cost
   *   is that the proxy rewrite becomes load-bearing (see that repo's api-proxy.test.ts).
   *
   * The hub's Embed panel therefore REFUSES to emit a relative base while this prop accepts
   * one: it cannot know where its snippet will be pasted, and the caller here does.
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
  /**
   * How old the nonce must be before the server will accept a submission (audience/nonce.ts
   * MIN_AGE_MS). Optional because a backend predating the field simply omits it — a form talking
   * to one then behaves exactly as it did before, submitting immediately.
   */
  minAgeMs?: number
}

/**
 * Slack added to the wait so a submission cannot land a millisecond under the floor. `setTimeout`
 * is a lower bound, so this is not correcting for early firing — it covers the rounding between
 * the two clocks and keeps the check off a knife edge. Small enough that nobody perceives it.
 */
const TIMING_FLOOR_BUFFER_MS = 250

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * How long the config GET may hang before the form gives up on it.
 *
 * Without this, a backend that accepts the connection and never answers pins the form on
 * `Loading…` forever on someone else's marketing page — the one state with no affordance at all,
 * not even the retry `unavailable` offers. A timeout is what converts "hung" into a state the
 * visitor can act on. Generous enough that a slow mobile connection is never mistaken for a dead
 * backend; short enough that nobody stares at a spinner for a minute.
 */
export const CONFIG_TIMEOUT_MS = 10_000

/**
 * The page the signup came from. The backend stores it as the consent record's provenance
 * (`consent_source_url`) — the evidence that this address opted in HERE and not somewhere else,
 * which is the whole point of keeping a consent trail.
 *
 * A named function rather than an inline ternary so the server-render branch is reachable from a
 * test: this component is `"use client"`, but a Next app still renders it once on the server
 * before hydration, where `window` does not exist and reading `.href` would throw during SSR
 * rather than merely omitting a field.
 */
export function signupSourceUrl(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.href
}

/**
 * The component's ONLY developer-facing signal.
 *
 * The visitor-facing copy is deliberately vague — a marketing page must not narrate the
 * backend's problems — which leaves the site owner who pasted the wrong key looking at a page
 * that seems fine, with nothing in devtools. Naming the key and the reason is what tells the
 * three indistinguishable causes apart: a typo'd key (404), a backend outage (500), and a
 * feature switched off for the ecosystem (also 404 — publicSignup.ts makes those two identical
 * on the wire on purpose, so a disabled feature is not detectable, which is precisely why the
 * key has to be in the console message instead).
 */
function reportFailure(what: string, publicKey: string, err: unknown): void {
  const reason = err instanceof Error ? err.message : String(err)
  console.error(`[EmailSignupForm] ${what} for public key "${publicKey}": ${reason}`)
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
   * When the CURRENT nonce arrived, by this browser's clock. A ref, not state: nothing renders
   * from it, and it must be readable by a submit that is already in flight.
   *
   * The wait below is measured as a DURATION FROM THIS MOMENT, never as a comparison between a
   * server timestamp and `Date.now()`. That is what makes it immune to clock skew: a visitor
   * whose machine is an hour off still measures three real seconds, and the network latency in
   * both directions only ever ADDS to the age the server computes.
   */
  const nonceReceivedAt = React.useRef(0)

  /** Adopt a freshly fetched config and stamp when its nonce arrived. Always paired. */
  const adoptConfig = React.useCallback((body: ListConfig) => {
    nonceReceivedAt.current = Date.now()
    setConfig(body)
  }, [])

  /**
   * The list config GET, factored out of the mount effect because a FAILED submit has to run it
   * again. The nonce it carries has a server-side lifetime (audience/nonce.ts MAX_AGE_MS, 30
   * minutes); fetching it once at mount meant a tab left open past that window could never sign
   * up again — every retry re-sent the same expired nonce, and the only cure was a page reload.
   */
  const fetchConfig = React.useCallback(async (): Promise<ListConfig> => {
    const res = await fetch(`${base}/public/signup-lists/${encodeURIComponent(publicKey)}`, {
      // A hung request must become a failure the visitor can see and retry, not an eternal
      // `Loading…`. `AbortSignal.timeout` rather than a hand-rolled controller so there is no
      // timer left to clear on the success path.
      signal: AbortSignal.timeout(CONFIG_TIMEOUT_MS),
    })
    // The status is carried in the message rather than discarded, because it is the only thing
    // that distinguishes a bad key from a dead backend once reportFailure logs it.
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ListConfig
  }, [base, publicKey])

  /**
   * Bumped by the retry control. It is in the mount effect's deps and nothing else's, so
   * incrementing it — and ONLY incrementing it — re-runs the config load.
   *
   * `unavailable` was previously terminal: both of the effect's other deps are stable
   * `useCallback`s, so nothing could ever re-enter it, and the copy told the visitor to "try
   * again later" while offering no way to try. Worse, this is the state every embed starts in
   * until the ecosystem's `email-signup` flag is switched on, so the dead end was the DEFAULT.
   * An operator who flips the flag must otherwise get every visitor to reload the page.
   */
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const body = await fetchConfig()
        if (cancelled) return
        adoptConfig(body)
        setPhase(body.status === "open" ? "ready" : "closed")
      } catch (err) {
        if (cancelled) return
        reportFailure("could not load the signup list", publicKey, err)
        setPhase("unavailable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchConfig, adoptConfig, publicKey, attempt])

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
      // The server refuses a nonce younger than its floor (audience/nonce.ts MIN_AGE_MS) — the
      // "no human filled this in that fast" check. A retry is exactly the case that trips it: the
      // failed attempt minted a fresh nonce, so the clock restarted, and a visitor who clicks
      // again straight away is rejected, mints ANOTHER nonce, and loops forever. Waiting the
      // remainder out here converts that loop into a submission that simply lands a moment later.
      //
      // Measured as a duration since the nonce ARRIVED, never as `Date.now()` vs a server
      // timestamp, so a skewed client clock cannot shorten it; latency only ever makes the age
      // the server computes larger than what we waited.
      const remaining = (config.minAgeMs ?? 0) - (Date.now() - nonceReceivedAt.current)
      // The buffer rides on top of a wait we are ALREADY doing rather than being added
      // unconditionally, so a visitor who spent longer than the floor filling the form — the
      // common case by far — submits with no delay at all.
      if (remaining > 0) await sleep(remaining + TIMING_FLOOR_BUFFER_MS)
      const res = await fetch(`${base}/public/signup-lists/${encodeURIComponent(publicKey)}/signups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          nonce: config.nonce,
          // The honeypot's value, forwarded verbatim. This is the ONLY thing that can ever put a
          // value in this field, and the server's entire content-based bot filter keys off it
          // (publicSignup.ts: non-empty `website` ⇒ uniform 200, nothing written). Sending a
          // constant `""` here would disable that defence completely and silently.
          website: honeypot,
          sourceUrl: signupSourceUrl(),
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
      adoptConfig(body)
      if (body.status !== "open") setPhase("closed")
    } catch (err) {
      // Silent to the VISITOR, not to the developer: the form the visitor keeps is now carrying
      // a nonce that may already be dead, so every retry from here can fail for a reason nothing
      // on the page explains. Logging is the only place that shows up.
      reportFailure("could not refresh the signup nonce", publicKey, err)
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
      <div className={cn("flex flex-col items-start gap-2 text-sm", className)}>
        {/* No longer "try again later" with nothing to try — the copy names an action the
            control below actually performs. */}
        <p>Signups are unavailable right now.</p>
        <button
          type="button"
          onClick={() => {
            // Back to `loading` so the click is visibly acknowledged; the bump is what re-runs
            // the effect. Both are needed: setting the phase alone would hang on `Loading…`
            // forever, and bumping alone would leave the failure copy on screen mid-retry.
            setPhase("loading")
            setAttempt((n) => n + 1)
          }}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Try again
        </button>
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
          opted out of autofill so a password manager never fills it. A human cannot reach it; a
          bot walking the DOM fills it and the server drops the submission silently.
          `autoComplete="off"` speaks only to the browser — a manager that decided this looked
          like a username would fill it and silently bin a real signup, so the field carries the
          full per-vendor opt-out from lib/autofill. */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        {...noAutofillProps}
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
