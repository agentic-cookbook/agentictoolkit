'use client'

import { AuthHttpError, extractErrorMessage, extractErrorCode } from './client'
import { isLocalHostname } from './hostname'

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
   * proxy (local dev): login still works, but silent SSO can't (the host-only
   * cookie isn't visible through the proxy), so it always shows central login.
   */
  authApiBase?: string
  /** In-site path to return to after login (default: the callback's own
   *  redirect). Stashed across the AS round-trip. */
  returnTo?: string
  /** The callback route that receives the `#code` (default '/auth/callback'). */
  callbackPath?: string
}

/** The configured AS base, trimmed of trailing slashes, or undefined. */
function authApiBaseOrEnv(explicit?: string): string | undefined {
  const base = explicit ?? process.env.NEXT_PUBLIC_AUTH_API_URL
  return base ? base.replace(/\/+$/, '') : undefined
}

/** Resolve an AS endpoint path against the configured AS base, falling back to
 *  the same-origin BFF proxy (`/api…`) when no base is set (local dev). The one
 *  place the base-vs-proxy choice for `/oauth/signin/*` is made. */
function asEndpoint(path: string, authApiBase?: string): string {
  const base = authApiBaseOrEnv(authApiBase)
  return base ? `${base}${path}` : `/api${path}`
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
  if (returnTo) {
    try {
      window.sessionStorage.setItem(RETURN_TO_KEY, returnTo)
    } catch {
      // sessionStorage can throw (private mode / disabled); the callback just
      // falls back to its default redirect.
    }
  }
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

/** Whether the AuthProvider should run a silent cold-load SSO check now. Never
 *  when we're mid-flow on the callback (`initialHash` captured at render) or have
 *  already checked this tab (which also breaks the login_required → home → re-check
 *  loop). Otherwise:
 *   - a readable HINT cookie is positive evidence a central session exists (the site
 *     shares the AS's apex) ⇒ restore, wherever we're served. The dev.local suite is
 *     same-apex with its AS, so a suite satellite restores exactly like prod — without
 *     this, a signed-in developer lands on every satellite with a logged-out header.
 *   - no hint ⇒ the only option is a BLIND once-per-tab probe, a top-level redirect to
 *     the AS made on a guess. Worth it for a DEPLOYED cross-apex site (it can't read
 *     the hint, and every deployed origin is on the AS's return-origin allow-list, so
 *     the worst case is a silent `#error=login_required` bounce). NOT worth it from a
 *     local host: an origin that isn't allow-listed (a bare `next dev` on
 *     localhost:3000) is bounced to the central login page instead of back — the
 *     "stranded on the hub login page" bug. So locally: hint, or nothing.
 *
 *  Locality is read from the live hostname rather than a build-time NEXT_PUBLIC_*
 *  literal: this package is built once and consumed by every site, so the env is a
 *  property of where it's served, not of how it was compiled. */
export function shouldSilentRestore(initialHash: string): boolean {
  if (typeof window === 'undefined') return false
  if (isMidAuthFlow(initialHash) || ssoCheckedThisTab()) return false
  if (ssoHintPresent()) return true
  return !isLocalHostname(window.location.hostname) && isCrossApex()
}

/**
 * Silent, NON-forcing cold-load SSO: a top-level navigation to
 * `/authorize?prompt=none`. If a central session exists the AS bounces a code
 * back (→ logged in); otherwise it returns `#error=login_required` and the page
 * quietly stays anonymous — the user is never dropped on the login form. Marks
 * the tab as checked first so a stale hint can't loop.
 *
 * The result returns to the CURRENT page (not the dedicated `/auth/callback`):
 * the page's own AuthProvider exchanges the `#code` IN PLACE, so only the header
 * re-renders — no callback bounce, no full-page reload. The current fragment is
 * dropped from the return so a stale `#code`/`#error` can't round-trip back in.
 */
export function beginSilentLogin(
  // Narrower than BeginLoginOptions: the silent flow ALWAYS returns to the current
  // page, so returnTo/callbackPath don't apply — excluding them stops a caller
  // from passing one and expecting it to take effect.
  opts: { clientId?: string; authApiBase?: string } = {},
): void {
  if (typeof window === 'undefined') return
  markSsoChecked()
  const { clientId = 'adh' } = opts
  const ret = `${window.location.origin}${window.location.pathname}${window.location.search}`
  window.location.href = buildAuthorizeUrl({
    clientId,
    returnUrl: ret,
    prompt: 'none',
    authApiBase: opts.authApiBase,
  })
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

export interface CentralEmailLoginParams extends CentralParams {
  /** AS base (e.g. https://api.agenticdeveloperhub.com); defaults to the env. */
  authApiBase?: string
  /** Email, user id (slug), or verified phone (E.164) — the AS classifies it. */
  identifier: string
  password: string
}

/**
 * Central credential login: POST the AS /oauth/signin/login with the brand
 * clientId + return, then top-level navigate to the exchange redirect it returns
 * (`<return>#code=…`). `credentials:'include'` so the central-session cookie the
 * AS sets (host-only on the AS host) is stored — that cookie is what lets the
 * NEXT brand site log in silently. Throws with the server's message on failure
 * (the caller surfaces it; no navigation happens).
 */
export async function centralEmailLogin(p: CentralEmailLoginParams): Promise<void> {
  const url = asEndpoint('/oauth/signin/login', p.authApiBase)
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    // The generic `identifier` key: the AS classifies email / slug / phone. The
    // legacy `email` key would pin the lookup to email-only.
    body: JSON.stringify({
      identifier: p.identifier,
      password: p.password,
      clientId: p.clientId,
      return: p.returnUrl,
    }),
  })
  if (!res.ok) {
    // Throw AuthHttpError (status + code) so callers can tell a 5xx (server broken)
    // from a 4xx (wrong password) and report only the former. A 5xx fallback message
    // says so rather than the generic credential message.
    const body = await res.json().catch(() => null)
    const fallback = res.status >= 500 ? `Server error (${res.status})` : 'Login failed'
    throw new AuthHttpError(res.status, extractErrorMessage(body, fallback), extractErrorCode(body))
  }
  const { redirectUrl } = (await res.json()) as { redirectUrl: string }
  window.location.href = redirectUrl
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
 *  intent. The OAuth callback writes the provider slug here on `account_exists`;
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
