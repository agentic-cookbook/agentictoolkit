'use client'

import { asEndpoint, authApiBaseOrEnv } from './asBase'
import { AuthHttpError, extractErrorMessage, extractErrorCode } from './client'
import {
  assertPasswordlessPasskey,
  assertSecondFactor,
  LOGIN_SMS_PATH,
  MFA_WEBAUTHN_OPTIONS_PATH,
  PASSKEY_OPTIONS_PATH,
  type MfaChallenge,
  type MfaCodeMethod,
} from './mfa'

// Client-side entry point for cross-site single sign-on. The browser-facing
// half of the engine in websites/backend/src/routes/oauthRedirect.ts: a top-level
// navigation to the authorization server's /authorize, which silently bounces an
// exchange code back when a central session already exists (logged in on any
// other brand site) and otherwise sends the browser to the central login page.

const DEFAULT_CALLBACK_PATH = '/auth/callback'
// Where AuthCallback should land after a successful exchange survives the
// round-trip through the AS in sessionStorage (the AS only echoes back `return`,
// the callback URL — not an arbitrary in-site destination).
const RETURN_TO_KEY = 'adh_sso_return_to'

export interface BeginLoginOptions {
  /** OAuth client id (default 'adh' — the shared brand-site client). */
  clientId?: string
  /**
   * Absolute base URL of the login/OAuth API (the authorization-server host,
   * e.g. `https://api.agenticdeveloperhub.com`). Wired from
   * `NEXT_PUBLIC_AUTH_API_URL`; defaults to that env var. The browser is sent
   * DIRECTLY here (not through the same-origin `/api` proxy) because the central
   * SSO cookie is host-only on the AS host — only a top-level navigation to that
   * host sends it, which is what makes the silent short-circuit possible. When
   * neither the option nor the env var is set, falls back to the same-origin BFF
   * proxy: a clicked Login still works (it ends at the central login form either
   * way), while the SILENT path refuses outright rather than spend a navigation the
   * proxy cannot answer — see {@link asBaseConfigured}. That unset case is a
   * misconfigured deploy, not a local convenience: the dev suite sets the var too.
   */
  authApiBase?: string
  /** In-site path to return to after login (default: the callback's own
   *  redirect). Stashed across the AS round-trip. */
  returnTo?: string
  /** The callback route that receives the `#code` (default '/auth/callback'). */
  callbackPath?: string
}

let warnedNoAsBase = false

/**
 * Whether an AS host is configured at all — the precondition for SILENT restore,
 * as opposed to an explicit Login (which works through the same-origin proxy).
 *
 * The proxy fallback in {@link asEndpoint} is right for a clicked Login and
 * structurally incapable of a silent one: the central session cookie is host-only
 * on the AS host, so the browser sends it on a top-level navigation THERE and
 * never to this site's own `/api`. A silent probe without the base therefore
 * spends a full-page navigation to learn nothing and comes back
 * `#error=login_required` — visibly a flash, and indistinguishable from "you are
 * not signed in" to the visitor.
 *
 * That is the ONLY way this returns false in practice, which is why it says so out
 * loud instead of degrading quietly: every hosted project gets the var from
 * `fleet vercel backend-env` (adh-tools), and the local dev suite sets it too
 * (`suite.toml` — `NEXT_PUBLIC_AUTH_API_URL = "https://{ADH_BACKEND_HOST}"`). An
 * unset var means a MISCONFIGURED DEPLOY, and it had gone unnoticed on all three
 * tiers of one site — a build guard now fails such a build
 * (`@agentic-toolkit/next-preflight`'s `assertAuthApiUrl`, run by `adhNextConfig()`),
 * and this is the runtime half: one console
 * error naming the variable, at the moment a restore is declined because of it.
 */
function asBaseConfigured(explicit?: string): boolean {
  if (authApiBaseOrEnv(explicit)) return true
  if (!warnedNoAsBase) {
    warnedNoAsBase = true
    console.error(
      '[adh-auth] NEXT_PUBLIC_AUTH_API_URL was not set when this site was built, so it ' +
        'cannot restore an existing central session: the silent check is a top-level ' +
        "navigation to the authorization server, and without its host it would go to this " +
        "origin's own /api proxy, which never sees the host-only central cookie. Clicking " +
        'Login still works. Set the variable on the deploy (`fleet vercel backend-env`) ' +
        'and rebuild.',
    )
  }
  return false
}

/**
 * Build an AS `/oauth/signin/authorize` URL — the single place the authorize
 * contract (path, params, base-vs-proxy fallback) is assembled, shared by
 * {@link beginLogin}, {@link beginSilentLogin}, and {@link ssoSwitchUrl}. With no
 * AS base configured it falls back to the same-origin BFF proxy (local dev).
 */
function buildAuthorizeUrl(opts: {
  clientId: string
  returnUrl: string
  prompt?: 'none'
  authApiBase?: string
}): string {
  const authorize = asEndpoint('/oauth/signin/authorize', opts.authApiBase)
  const params = new URLSearchParams({ clientId: opts.clientId, return: opts.returnUrl })
  if (opts.prompt) params.set('prompt', opts.prompt)
  return `${authorize}?${params.toString()}`
}

/**
 * Build an AS `/oauth/signin/start` URL — the single place the START contract
 * (path, params, base-vs-proxy fallback) is assembled, the sibling of
 * {@link buildAuthorizeUrl} above. `/start` is the *provider* leg: it 302s to
 * GitHub/Google/…, and the AS sends the browser to `returnUrl` with the exchange
 * code once the provider comes back. Sign-in and sign-up are the same request —
 * the backend JIT-creates the account and enforces the `new_user_signups` gate
 * there — so a signup page and a login page name the identical endpoint.
 *
 * Used by {@link LoginCard}'s provider buttons and by the hub's own signup page;
 * exported rather than inlined so those two can't drift apart on the query
 * contract (`clientId` / `providerId` / `return`).
 */
export function providerSigninUrl(opts: {
  clientId: string
  providerId: string
  /** Absolute URL the AS returns the browser to (this site's callback route). */
  returnUrl: string
  authApiBase?: string
}): string {
  const start = asEndpoint('/oauth/signin/start', opts.authApiBase)
  const params = new URLSearchParams({
    clientId: opts.clientId,
    providerId: opts.providerId,
    return: opts.returnUrl,
  })
  return `${start}?${params.toString()}`
}

/**
 * Start the SSO flow: navigate the browser top-level to the AS /authorize for
 * this site's callback. The AS decides what happens next — silent code bounce if
 * a central session exists, else a redirect to the central login page.
 */
export function beginLogin(opts: BeginLoginOptions = {}): void {
  if (typeof window === 'undefined') return
  const { clientId = 'adh', returnTo, callbackPath = DEFAULT_CALLBACK_PATH } = opts
  if (returnTo) stashReturnTo(returnTo)
  const ret = `${window.location.origin}${callbackPath}`
  window.location.href = buildAuthorizeUrl({ clientId, returnUrl: ret, authApiBase: opts.authApiBase })
}

// --- silent cold-load restore -------------------------------------------------
// On first visit to a brand site (no per-site session yet) the header should
// reflect an existing central login without a click. The AuthProvider runs a
// SILENT, non-forcing check on cold load — but only when it's worth it, so
// anonymous/public visitors never redirect. See shouldSilentRestore.

const SSO_CHECKED_KEY = 'adh_sso_checked'
const SSO_HINT_COOKIE = 'adh_sso_hint'

// True when the URL fragment carries an in-flight SSO result (`#code`/`#error`),
// i.e. we're mid-flow on the callback page, which must never re-trigger a silent
// check. The caller passes a hash captured at RENDER time (before any effect —
// e.g. AuthCallback — can strip the fragment), so there's no effect-ordering race.
// Shares parseInboundSso so the two detectors can't drift on the fragment shape.
function isMidAuthFlow(hash: string): boolean {
  return parseInboundSso(hash) !== null
}

/** The readable central-session hint the AS sets on its registrable domain.
 *  Present ⇒ a central session likely exists AND this site shares the AS apex
 *  (only same-apex brand sites can read it). Cross-apex sites can't, so they
 *  simply don't auto-restore — never a wasted redirect. */
export function ssoHintPresent(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some((p) => p.startsWith(`${SSO_HINT_COOKIE}=`))
}

function ssoCheckedThisTab(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_CHECKED_KEY) === '1'
  } catch {
    return false
  }
}

export function markSsoChecked(): void {
  try {
    window.sessionStorage.setItem(SSO_CHECKED_KEY, '1')
  } catch {
    /* sessionStorage unavailable — worst case we re-check once more */
  }
}

/** Reset the once-per-tab guard so a fresh login can be auto-detected again
 *  (called on logout). */
export function clearSsoChecked(): void {
  try {
    window.sessionStorage.removeItem(SSO_CHECKED_KEY)
  } catch {
    /* ignore */
  }
}

// Last two labels of a host. CORRECT for every adh domain (all single-label
// TLDs: .com / .ai / .studio / .today …). It is only an apex-equality heuristic —
// a multi-label public suffix (e.g. example.co.uk) would resolve to `co.uk` and
// mis-compare; if such a domain is ever added, switch to a Public Suffix List.
function registrableDomain(host: string): string {
  const labels = host.split('.')
  return labels.length >= 2 ? labels.slice(-2).join('.') : host
}

/** True when this brand site is on a DIFFERENT registrable domain than the AS
 *  (e.g. cookbook.com vs agenticdeveloperhub.com) — so it can't read the hint
 *  cookie and must probe once per tab instead of hint-gating. Returns false when
 *  no AS host is configured (can't probe usefully — the same-origin proxy can't
 *  see the host-only session cookie). */
function isCrossApex(): boolean {
  if (typeof window === 'undefined') return false
  const base = process.env.NEXT_PUBLIC_AUTH_API_URL
  if (!base) return false
  try {
    return (
      registrableDomain(new URL(base).hostname) !== registrableDomain(window.location.hostname)
    )
  } catch {
    return false
  }
}

/** The AS endpoint that answers "will you bounce a `prompt=none` check back to
 *  this origin, or strand the browser on the central login page?" — see
 *  {@link preflightSsoReturn}. */
const PREFLIGHT_PATH = '/oauth/signin/preflight'

/**
 * Ask the AS whether a `prompt=none` check for `returnUrl` will be RETURNED to
 * this origin. This is the guard that makes the silent probe safe to run
 * anywhere, including on a public landing page: the probe is a top-level
 * navigation, and its one bad outcome is the AS having nowhere to send the
 * browser back to (this origin missing from the client's return-origin
 * allow-list, or an AS that isn't up), which leaves a visitor who asked for a
 * marketing page looking at a login form. Asking first turns that from a risk
 * taken on a guess into a fact checked in advance.
 *
 * Asked of the SAME host the probe would navigate to — {@link asEndpoint}, so the
 * AS host directly when one is configured, and the same-origin `/api` proxy only for
 * a direct caller, since {@link beginSilentLogin} no longer reaches here without a
 * base at all. That pairing is the whole correctness argument: the allow-list lives in the
 * answering server's own client row, and the two URLs are not always the same
 * server. In the dev.local suite `API_BACKEND_URL` is this worktree's backend
 * while `NEXT_PUBLIC_AUTH_API_URL` is the shared authorization service with its
 * own database — routing the question through the proxy would ask one server to
 * speak for another's allow-list, and a wrong `false` is indistinguishable from
 * the bug this exists to fix.
 *
 * A cross-origin GET needs CORS, and no site in the fleet gets per-site origin
 * config. It does not need any: the endpoint reads no cookie and no
 * `Authorization` header, so it answers `Access-Control-Allow-Origin: *` for
 * everyone (the `/public/signup-lists/*` precedent in the backend's app.ts).
 * `credentials: 'omit'` is what makes that legal, so it is load-bearing rather
 * than tidiness — `*` with credentials is refused by browsers outright.
 *
 * Anything other than an explicit `allowed: true` — a network error, a non-200, a
 * body of the wrong shape, a CORS refusal, a wedged server — means NO. The probe is
 * then skipped and the page stays anonymous, which is exactly where it would have
 * been had it never asked. Failing closed here costs an avatar; failing open costs
 * the visitor the page they asked for.
 */
export async function preflightSsoReturn(opts: {
  clientId: string
  returnUrl: string
  /** AS base; defaults to `NEXT_PUBLIC_AUTH_API_URL` (see {@link BeginLoginOptions}). */
  authApiBase?: string
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}): Promise<boolean> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') return false
  const params = new URLSearchParams({ clientId: opts.clientId, return: opts.returnUrl })
  try {
    const res = await doFetch(`${asEndpoint(PREFLIGHT_PATH, opts.authApiBase)}?${params.toString()}`, {
      // No cookies are needed or wanted: the question is purely about
      // configuration, and sending credentials would make a public config lookup
      // look like an authenticated call to every proxy and log in between.
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: preflightTimeoutSignal(),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { allowed?: unknown }
    return body?.allowed === true
  } catch {
    return false
  }
}

/** How long the preflight may take before it counts as a NO.
 *
 *  The AuthProvider AWAITS this on cold load and only calls `setIsLoading(false)`
 *  after it settles, so an unbounded wait is not a slow answer — it is a header that
 *  never resolves for the rest of the page's life, on a page the visitor asked for
 *  by name. A hung TCP connection (a wedged AS, a captive-portal DNS answer, a
 *  dropped route) does not fail fast on its own: the platform default is tens of
 *  seconds to minutes, and `fetch` has none of its own at all.
 *
 *  Two seconds because the answer is a small uncached JSON read that the AS serves
 *  from one indexed row, and because the cost of being wrong is asymmetric and
 *  small: a timed-out preflight leaves the visitor anonymous with a working Login
 *  button, exactly as a `false` does, and the next navigation asks again. */
const PREFLIGHT_TIMEOUT_MS = 2_000

/** `AbortSignal.timeout` where the runtime has it, `undefined` where it does not —
 *  an old browser (or a stubbed test global) then behaves exactly as before rather
 *  than throwing here, which would turn a missing convenience into a failed login.
 *  Not inlined so the version check has one home and one comment. */
function preflightTimeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS)
    : undefined
}

/** Whether the AuthProvider should run a silent cold-load SSO check now. Never
 *  when we're mid-flow on the callback (`initialHash` captured at render) or we've
 *  already checked this tab (which also breaks the login_required → home →
 *  re-check loop). Otherwise:
 *   - a readable HINT cookie is positive evidence a central session exists (the site
 *     shares the AS's apex) ⇒ restore, wherever we're served. The dev.local suite is
 *     same-apex with its AS, so a suite satellite restores exactly like prod — without
 *     this, a signed-in developer lands on every satellite with a logged-out header.
 *   - no hint on a SAME-APEX site is conclusive the other way: the hint is written
 *     whenever the central session is, so its absence means there is nothing to
 *     restore and a probe would spend a redirect to learn nothing.
 *   - no hint on a CROSS-APEX site proves nothing — it cannot read the cookie at
 *     all — so it has to ask, on every route including the landing deck.
 *
 *  It DOES refuse when no AS host is configured, whatever the hint says — see
 *  {@link asBaseConfigured}. The hint proves a central session exists; it does not
 *  give this build anywhere to go and ask for it. That combination is exactly what
 *  a same-apex site with an unset `NEXT_PUBLIC_AUTH_API_URL` used to hit: hint
 *  present ⇒ probe ⇒ a top-level navigation to its own proxy ⇒ `login_required` ⇒
 *  a logged-out header, once per tab, with a flash on the way.
 *
 *  This deliberately no longer refuses on a landing route or a local hostname.
 *  Both were client-side guesses at the same question — "will the AS bring the
 *  browser back, or strand it?" — and the answer is not the client's to guess:
 *  {@link beginSilentLogin} now gets it from the AS before it navigates. A guess
 *  that is wrong in the safe direction is what made a signed-in visitor look
 *  logged out on the front page of every cross-apex site. Locality in particular
 *  was a proxy for "this origin probably isn't allow-listed", which the preflight
 *  answers exactly, for localhost and dev.local alike. */
export function shouldSilentRestore(initialHash: string): boolean {
  if (typeof window === 'undefined') return false
  if (isMidAuthFlow(initialHash) || ssoCheckedThisTab()) return false
  // Checked BEFORE the hint: without an AS host there is nowhere to probe, so no
  // evidence a session exists can change the answer.
  if (!asBaseConfigured()) return false
  if (ssoHintPresent()) return true
  return isCrossApex()
}

/**
 * Silent, NON-forcing cold-load SSO: a top-level navigation to
 * `/authorize?prompt=none`. If a central session exists the AS bounces a code
 * back (→ logged in); otherwise it returns `#error=login_required` and the page
 * quietly stays anonymous — the user is never dropped on the login form.
 *
 * PRE-FLIGHTED: the "never dropped on the login form" promise above is only true
 * for a return origin the AS actually allow-lists, and a site cannot know that
 * about itself — the list lives in the AS's client row and converges on each
 * backend deploy, so a newly registered site is missing from it for a while. So
 * ask ({@link preflightSsoReturn}) and navigate only on a yes. On a no this
 * returns `false` having navigated NOWHERE, and the caller leaves the page
 * anonymous. That is what lets the probe run on public landing routes: the
 * failure mode it used to risk there no longer exists.
 *
 * The tab's one check is spent either way — a "no" is a fact about this origin's
 * configuration, which will not change while the tab is open, so re-asking on
 * every route change would be pure cost.
 *
 * The result returns to the CURRENT page (not the dedicated `/auth/callback`):
 * the page's own AuthProvider exchanges the `#code` IN PLACE, so only the header
 * re-renders — no callback bounce, no full-page reload. The current fragment is
 * dropped from the return so a stale `#code`/`#error` can't round-trip back in.
 *
 * @returns `true` when the browser is navigating to the AS (the caller must stop
 * and keep its loading state), `false` when nothing happened.
 */
export async function beginSilentLogin(
  // Narrower than BeginLoginOptions: the silent flow ALWAYS returns to the current
  // page, so returnTo/callbackPath don't apply — excluding them stops a caller
  // from passing one and expecting it to take effect.
  opts: { clientId?: string; authApiBase?: string; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  markSsoChecked()
  // Independently of shouldSilentRestore, which is not every caller's route here: a
  // silent probe through the same-origin proxy cannot succeed, so refusing costs
  // nothing and saves the navigation ({@link asBaseConfigured}). The tab's one check
  // is still spent — the answer is a build fact and will not change while it is open.
  if (!asBaseConfigured(opts.authApiBase)) return false
  const { clientId = 'adh' } = opts
  const ret = `${window.location.origin}${window.location.pathname}${window.location.search}`
  // Same authApiBase the navigation below uses, so the server that answers the
  // question is the server that acts on it.
  const allowed = await preflightSsoReturn({
    clientId,
    returnUrl: ret,
    authApiBase: opts.authApiBase,
    fetchImpl: opts.fetchImpl,
  })
  if (!allowed) return false
  window.location.href = buildAuthorizeUrl({
    clientId,
    returnUrl: ret,
    prompt: 'none',
    authApiBase: opts.authApiBase,
  })
  return true
}

/**
 * Wrap an absolute destination URL on another brand site into a top-level
 * `prompt=none` AS authorize URL whose `return` is that destination, so a switch
 * lands there ALREADY signed in: the AS silently bounces an exchange `#code`
 * straight to the destination page, whose AuthProvider exchanges it in place.
 * No logged-out flash on the destination, no callback bounce, no reload.
 *
 * Returns `destUrl` unchanged when no AS base is configured (local dev, where
 * cross-origin SSO is unreachable): the switch is then a plain navigation, the
 * same as before. Used by the site switcher when the user is signed in.
 *
 * NOTE: the destination origin must be on the 'adh' client's return-origin
 * allow-list (it is, for every registered site — see registry.ssoReturnOrigins).
 * If a target's origin is ever missing from the seeded allow-list, the AS
 * `prompt=none` path falls through to the central login page instead of bouncing
 * a code back — the same allow-list dependency the silent cold-load restore has.
 */
export function ssoSwitchUrl(
  destUrl: string,
  opts: { clientId?: string; authApiBase?: string } = {},
): string {
  const base = authApiBaseOrEnv(opts.authApiBase)
  if (!base) return destUrl
  return buildAuthorizeUrl({
    clientId: opts.clientId ?? 'adh',
    returnUrl: destUrl,
    prompt: 'none',
    authApiBase: base,
  })
}

/** A cross-site SSO result delivered in a page's URL fragment: a one-time
 *  exchange `code`, or an `error` (e.g. `login_required` from a silent check). */
export interface InboundSso {
  code?: string
  error?: string
}

/** Parse an inbound SSO result from a URL fragment (the `#code=…` / `#error=…`
 *  the AS bounces back). Returns null when the fragment carries neither — i.e.
 *  this is an ordinary page load, not an SSO landing. */
export function parseInboundSso(hash: string): InboundSso | null {
  if (!hash) return null
  const frag = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(frag)
  const code = params.get('code')
  if (code) return { code }
  const error = params.get('error')
  if (error) return { error }
  return null
}

/**
 * Strip the SSO `code`/`error` keys from a URL fragment, KEEPING anything else
 * the page legitimately carried — notably the site-switcher's `#site-switch`
 * up-walk marker (the AS appends `&code=…` to it) and any scroll anchor. Returns
 * '' when nothing remains. Used to clean the address bar after an in-place
 * exchange without destroying a non-SSO fragment.
 */
export function stripSsoFragment(hash: string): string {
  const frag = hash.startsWith('#') ? hash.slice(1) : hash
  if (!frag) return ''
  const kept = frag.split('&').filter((part) => {
    const key = part.split('=')[0]
    return key !== 'code' && key !== 'error'
  })
  return kept.length ? `#${kept.join('&')}` : ''
}

export interface SsoLogoutOptions {
  /** OAuth client id (default 'adh'); selects the return-origin allow-list the
   *  AS validates the post-logout redirect against. Admin uses 'admin'. */
  clientId?: string
  /** AS base; defaults to `NEXT_PUBLIC_AUTH_API_URL` (see beginLogin). */
  authApiBase?: string
  /** In-site path to land on after logout (default the site root '/'). */
  returnTo?: string
}

/**
 * End the central SSO session. Like beginLogin, this MUST be a top-level
 * navigation: the central session cookie is host-only + SameSite=Lax on the AS
 * host, so only a top-level request to that host carries it — a same-origin fetch
 * through the BFF proxy can't reach it. The AS revokes the central session, clears
 * the cookie, and 302s back to `returnTo` on this origin. Without this, dropping
 * the brand site's own session leaves the central cookie live and the next
 * beginLogin logs the user straight back in (logout would be a no-op under SSO).
 * With no AS base configured, falls back to the same-origin proxy (local dev): the
 * brand-site session is already gone, but the central cookie can't be reached
 * through the proxy — same limitation as beginLogin's silent SSO.
 */
export function ssoLogout(opts: SsoLogoutOptions = {}): void {
  if (typeof window === 'undefined') return
  const { clientId = 'adh', returnTo = '/' } = opts
  const ret = `${window.location.origin}${returnTo}`
  const logout = asEndpoint('/oauth/signin/logout', opts.authApiBase)
  window.location.href = `${logout}?clientId=${encodeURIComponent(clientId)}&return=${encodeURIComponent(ret)}`
}

/**
 * Resolve a stashed return-to value to a SAME-ORIGIN, purely-relative path, or null (SEC-M8). The
 * stashed value is frequently the raw page pathname, and the WHATWG URL parser resolves a
 * protocol-relative `//evil.com/x` (or control-char-obfuscated) form to a CROSS-ORIGIN URL — which,
 * fed to `location.replace` after login, is an open redirect. So resolve against our origin, reject
 * anything whose origin differs, and return only `pathname+search+hash` — never the raw string.
 * Hoisted here as the single choke point so EVERY consumer — `takeReturnTo` (AuthCallback,
 * SsoCallback, …) AND hub's login `?next=` handling — shares one origin-validation implementation
 * that can't drift. Exported for that reuse.
 */
export function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

/**
 * Stash the in-site destination to land on once the AS round-trip completes.
 *
 * The AS echoes back only `return` — the callback URL — so an in-site destination
 * has to be remembered on this side or it is lost. Every path that sends the
 * browser to the AS with a destination in mind goes through here ({@link beginLogin}
 * and {@link centralLoginTarget}), so the key is written in one place and read in
 * one ({@link takeReturnTo}).
 */
export function stashReturnTo(returnTo: string): void {
  try {
    window.sessionStorage.setItem(RETURN_TO_KEY, returnTo)
  } catch {
    // sessionStorage can throw (private mode / disabled); the callback just falls
    // back to its default redirect.
  }
}

/** Read and clear the stashed post-login destination, validated to a same-origin relative path. */
export function takeReturnTo(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(RETURN_TO_KEY)
    if (v) window.sessionStorage.removeItem(RETURN_TO_KEY)
    return safeReturnTo(v)
  } catch {
    return null
  }
}

// --- central login page -----------------------------------------------------
// When /authorize finds no central session it redirects the browser to the
// central login page (CENTRAL_LOGIN_URL = the hub's /login) with the originating
// brand site's clientId + return in the query. That page MUST funnel whichever
// way the user authenticates back to that return, so the exchange code lands on
// the brand site that started login — not on the hub. These two helpers are the
// browser half of that contract (the AS half lives in oauthRedirect.ts /login).

/** The clientId + return the AS appended to CENTRAL_LOGIN_URL. */
export interface CentralParams {
  /** OAuth client the brand site began login against ('adh' or 'admin'). */
  clientId: string
  /** The brand-site callback URL the AS must bounce the exchange code back to. */
  returnUrl: string
}

/**
 * Read the central-login query the AS appended to CENTRAL_LOGIN_URL. Returns
 * null when there is no `return` — i.e. a plain direct visit to the login page,
 * which stays an in-site login rather than a cross-site round-trip. Defaults to
 * the current `window.location.search` when `search` is omitted.
 */
export function readCentralParams(search?: string): CentralParams | null {
  if (search === undefined && typeof window === 'undefined') return null
  const params = new URLSearchParams(search ?? window.location.search)
  const returnUrl = params.get('return')
  if (!returnUrl) return null
  return { clientId: params.get('clientId') ?? 'adh', returnUrl }
}

/** Which brand site a central login step owes its exchange code to, and where to
 *  ask. Carried on EVERY step (the AS re-validates the pair each time — a pending
 *  token names a user and their factors, deliberately not a destination). */
export interface CentralLoginTarget extends CentralParams {
  /** AS base (e.g. https://api.agenticdeveloperhub.com); defaults to the env. */
  authApiBase?: string
}

/**
 * The central-login target for the page calling this — the ONE decision that makes
 * every credential login in the fleet the same login.
 *
 * When the AS relayed another site's login here it named the target; use it. When
 * the visitor came DIRECTLY to this login page the AS named nothing, and the
 * temptation is to read that as "no cross-site login is involved, so log in
 * locally". That reading is the defect this function exists to remove: an in-site
 * login mints only this origin's session, the central cookie is never set, and the
 * visitor is signed in HERE and anonymous on all 40-odd other sites — which is
 * exactly what a hub sign-in did, the one login in the fleet that established no
 * central session. So a direct visit is not a different kind of login; it is the
 * same central login with the parameters the AS WOULD have supplied for a login
 * begun on this site: this client, and this site's own callback.
 *
 * The synthesized case is also the only one with an in-site destination to keep
 * (the relayed one belongs to the other site), so it stashes `returnTo` for
 * {@link takeReturnTo} — bundled here rather than left to the caller so a
 * synthesized target can't be built without preserving where the visitor was going.
 */
export function centralLoginTarget(opts: {
  /** This card's OAuth client, used when the AS named none. */
  clientId: string
  /** The callback route that receives the `#code` (default '/auth/callback'). */
  callbackPath?: string
  authApiBase?: string
  /** In-site destination to land on after the exchange (synthesized case only). */
  returnTo?: string
}): CentralLoginTarget {
  const relayed = readCentralParams()
  if (relayed) return { ...relayed, authApiBase: opts.authApiBase }
  if (opts.returnTo) stashReturnTo(opts.returnTo)
  return {
    clientId: opts.clientId,
    returnUrl: `${window.location.origin}${opts.callbackPath ?? DEFAULT_CALLBACK_PATH}`,
    authApiBase: opts.authApiBase,
  }
}

/**
 * POST one step of a central login and act on the answer. The three outcomes are
 * the same for every step, which is why they are decided here once:
 *
 *  - **202** — the account owes a second factor. Returned to the caller as the
 *    {@link MfaChallenge} to render; nothing has been minted.
 *  - **2xx** — done. The AS has set the central session cookie on its own host and
 *    handed back `<return>#code=…`; navigate there, so the exchange code lands on
 *    the brand site that started the login.
 *  - **anything else** — throw {@link AuthHttpError} (status + code), so a caller
 *    can tell a 5xx (server broken, worth reporting) from a 4xx (wrong password).
 *
 * `credentials: 'include'` is the load-bearing part: the central session cookie is
 * host-only on the AS host, so without it the response's Set-Cookie is dropped and
 * the login degrades to exactly the site-only session this whole path replaces.
 *
 * It REFUSES, loudly, when no AS host is configured. {@link asEndpoint} would
 * otherwise fall back to this origin's own `/api` relay, and a relayed central login
 * is not a slower central login: the AS's Set-Cookie comes back through THIS host, so
 * the host-only central cookie lands on the brand site instead of the AS. The login
 * then appears to succeed — a code is exchanged, this site's header fills in — while
 * no central session exists, which is the site-only session that made a signed-in
 * visitor anonymous on the other 40-odd sites. Failing outright is the lesser harm by
 * a wide margin: a build that cannot log in gets fixed, and one that logs you in
 * exactly once, on one site, is the bug that took weeks to find. It is also not a
 * path any deploy takes — `@agentic-toolkit/next-preflight`'s `assertAuthApiUrl` fails
 * a hosted build with the
 * variable unset, and the dev suite sets it — so this is the backstop for a build
 * that slipped past the guard, not a supported mode.
 */
async function centralLoginStep(
  path: string,
  target: CentralLoginTarget,
  body: Record<string, unknown>,
): Promise<MfaChallenge | null> {
  if (!authApiBaseOrEnv(target.authApiBase)) {
    throw new Error(
      'Sign-in is misconfigured on this site: NEXT_PUBLIC_AUTH_API_URL was not set when ' +
        'it was built, so there is no authorization server to sign in against. Set the ' +
        'variable on the deploy (`fleet vercel backend-env`) and rebuild.',
    )
  }
  const res = await fetch(asEndpoint(path, target.authApiBase), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, clientId: target.clientId, return: target.returnUrl }),
  })
  // Before res.ok: 202 IS ok, and it carries a challenge rather than a redirect.
  if (res.status === 202) return (await res.json()) as MfaChallenge
  if (!res.ok) {
    const failure = await res.json().catch(() => null)
    const fallback = res.status >= 500 ? `Server error (${res.status})` : 'Login failed'
    throw new AuthHttpError(
      res.status,
      extractErrorMessage(failure, fallback),
      extractErrorCode(failure),
    )
  }
  const { redirectUrl } = (await res.json()) as { redirectUrl: string }
  window.location.href = redirectUrl
  return null
}

export interface CentralEmailLoginParams extends CentralLoginTarget {
  /** Email, user id (slug), or verified phone (E.164) — the AS classifies it. */
  identifier: string
  password: string
}

/**
 * Central credential login. On success the browser navigates to the brand site with
 * the exchange code and this never returns; a `null` therefore means "navigating".
 * A non-null {@link MfaChallenge} means the account owes a second factor — complete
 * it with {@link centralCompleteMfaCode} / {@link centralCompleteMfaPasskey}, NOT
 * with the site's own `/api/auth/login/mfa`: only the central completions mint the
 * central session, and finishing a central password step on the site route is how a
 * login ends up half-done.
 */
export function centralEmailLogin(p: CentralEmailLoginParams): Promise<MfaChallenge | null> {
  // The generic `identifier` key: the AS classifies email / slug / phone. The
  // legacy `email` key would pin the lookup to email-only.
  return centralLoginStep('/oauth/signin/login', p, {
    identifier: p.identifier,
    password: p.password,
  })
}

/** Push an SMS code for a central login's pending challenge. Prepares a factor
 *  rather than satisfying one, so it has no central twin on the AS — the shared
 *  path is called against the AS directly for the same reason every other step is:
 *  one host answers for the pending token it issued. */
export async function centralSendMfaSms(
  target: CentralLoginTarget,
  token: string,
): Promise<void> {
  const res = await fetch(asEndpoint(LOGIN_SMS_PATH, target.authApiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const failure = await res.json().catch(() => null)
    throw new AuthHttpError(
      res.status,
      extractErrorMessage(failure, 'Could not send a code.'),
      extractErrorCode(failure),
    )
  }
}

/** Satisfy a central login's second factor with a typed code (sms / totp / recovery). */
export function centralCompleteMfaCode(
  target: CentralLoginTarget,
  token: string,
  method: MfaCodeMethod,
  code: string,
): Promise<MfaChallenge | null> {
  return centralLoginStep('/oauth/signin/login/mfa', target, { token, method, code })
}

/** Satisfy a central login's second factor with a passkey / security key. */
export async function centralCompleteMfaPasskey(
  target: CentralLoginTarget,
  token: string,
): Promise<MfaChallenge | null> {
  const assertion = await assertSecondFactor(
    token,
    asEndpoint(MFA_WEBAUTHN_OPTIONS_PATH, target.authApiBase),
  )
  return centralLoginStep('/oauth/signin/login/mfa/webauthn', target, { ...assertion })
}

/** Central PASSWORDLESS passkey login: the assertion is the only factor. */
export async function centralPasswordlessPasskey(
  target: CentralLoginTarget,
  identifier: string,
): Promise<MfaChallenge | null> {
  const assertion = await assertPasswordlessPasskey(
    identifier,
    asEndpoint(PASSKEY_OPTIONS_PATH, target.authApiBase),
  )
  return centralLoginStep('/oauth/signin/login/webauthn', target, { ...assertion })
}

export interface BeginLinkProviderOptions {
  /** Provider slug to link, e.g. 'github'. */
  providerId: string
  /** Where to return after the link round-trip — an in-site path or absolute URL. */
  returnTo: string
  /** OAuth client id (default 'adh'). */
  clientId?: string
  /** AS base; defaults to NEXT_PUBLIC_AUTH_API_URL (see beginLogin). */
  authApiBase?: string
}

/** sessionStorage key holding the reactive "link this provider after login"
 *  intent. The OAuth callback writes the provider slug here when the visitor
 *  ACKNOWLEDGES its `account_exists` notice — never before, because every reader
 *  below takes the key's presence to mean the visitor already agreed, and one of
 *  them (ProviderLinkHandler) is mounted on the callback page too;
 *  the login page reads it for a notice; LoginCard reads it after a successful
 *  password login to prompt the link-confirm modal; ProviderLinkHandler clears it
 *  when it completes the returning `#link_code`. Single source of truth so a
 *  rename can't silently desync them. */
export const PENDING_LINK_KEY = 'adh_pending_link'

/** sessionStorage key holding the in-flight link nonce (see beginLinkProvider). */
export const LINK_NONCE_KEY = 'adh_link_nonce'

/** A random, unguessable token. Uses crypto.randomUUID when available. */
function randomNonce(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Start the link-mode redirect: a top-level navigation to the AS
 *  /oauth/signin/start?link=1. Goes DIRECTLY to the AS host (not the /api proxy)
 *  so /start and /callback share a host for the oauth_state cookie. The link is
 *  authorized later by the bearer token on /auth/link-provider, not here.
 *
 *  Stashes an unguessable `linkNonce` (round-tripped through the signed state and
 *  echoed back in the callback fragment) so the page completing the `#link_code`
 *  can prove the flow was started by THIS browser — a forged `#link_code` URL the
 *  user is lured to carries no matching nonce and is refused (CSRF defense).
 *
 *  @returns `true` if the link redirect was initiated; `false` if the CSRF nonce
 *  could not be stashed (storage unavailable) — in which case it does NOT
 *  navigate, since the completion would fail closed anyway, and the caller can
 *  surface an error instead of bouncing the user through a doomed round-trip. */
export function beginLinkProvider(opts: BeginLinkProviderOptions): boolean {
  if (typeof window === 'undefined') return false
  const { providerId, returnTo, clientId = 'adh' } = opts
  const ret = /^https?:\/\//.test(returnTo) ? returnTo : `${window.location.origin}${returnTo}`
  const linkNonce = randomNonce()
  try {
    window.sessionStorage.setItem(LINK_NONCE_KEY, linkNonce)
  } catch {
    // Can't stash the nonce (private mode / storage blocked). Without it the
    // completion check fails closed, so don't send the user on a doomed OAuth
    // round-trip — report failure and let the caller show an error.
    return false
  }
  const start = asEndpoint('/oauth/signin/start', opts.authApiBase)
  const params = new URLSearchParams({ link: '1', clientId, providerId, return: ret, linkNonce })
  window.location.href = `${start}?${params.toString()}`
  return true
}
