"use client";

// The redirect round-trip loses React state (the browser leaves the app and comes back
// on a fresh page load), so the connect flow stashes the context it will need on return
// in `sessionStorage`, KEYED BY the signed `state` the start endpoint returned. The
// callback reads `state` from the query, looks the context up, finishes the connect with
// whatever credential the provider sent back beside it, and clears the entry. Keying by
// `state` (not a fixed key) keeps two in-flight connects from clobbering each other and
// ties the stash to the exact CSRF token the provider echoes back.

import { currentReturnTo as addressNow, safeReturnTo } from "@agentic-toolkit/auth";

/** The auth methods that use the browser-redirect round-trip. */
export type RedirectAuthMethod = "oauth" | "oauth_instance" | "github_app";

const REDIRECT_METHODS: readonly RedirectAuthMethod[] = ["oauth", "oauth_instance", "github_app"];

interface PendingConnectBase {
  providerId: string;
  serviceType: string;
  /** The ecosystem the connection belongs to — sent as `ecosystemId` on the connect that
   *  finishes this flow; the backend authorizes the caller against it. Required. */
  ecosystemId: string;
  /** Where to route back to (the integrations topic detail) once connected. */
  returnTo: string;
}

/**
 * The stashed context, discriminated by the branch that will finish it.
 *
 * `redirectUri` lives on the OAuth variants ONLY, and that is the point of splitting the
 * type rather than making it optional: an app returns to the setup URL configured ON THE
 * APP, so `github_app` never sent a redirect_uri and has none to echo — while an OAuth
 * token exchange that echoes a blank one is a mismatch, not a default. Encoding it here
 * means the callback cannot reach for a redirect_uri that was never supposed to exist.
 */
export type PendingOAuthConnect =
  | (PendingConnectBase & {
      authMethod: "oauth" | "oauth_instance";
      /** The exact `redirect_uri` sent to the start endpoint; the connect must echo it. */
      redirectUri: string;
    })
  | (PendingConnectBase & { authMethod: "github_app" });

const keyFor = (state: string) => `int-oauth-connect:${state}`;

/**
 * The fragment a host writes when its connections surface is open, and therefore the one part
 * of a return address that can be reconstructed without ever having seen it.
 *
 * It lives in THIS package rather than in the console that writes it, because both ends of the
 * round-trip need the same string: the console puts it in the address so `currentReturnTo`
 * captures it, and the callback appends it to the fallback it has to invent when the return
 * arrives on an origin that stashed nothing. `@agentic-toolkit/shipr` re-exports it — the
 * dependency points down, and a second spelling of it would fail silently in exactly one
 * direction.
 */
export const CONNECTIONS_HASH = "#connections";

/**
 * Where to send someone whose return context we had to rebuild — the one path every site in
 * the family mounts and resolves a workspace from, plus {@link CONNECTIONS_HASH} so the
 * console it lands on opens the surface the connect was started from instead of a bare tree.
 *
 * On a site whose `/home` has no connections surface the fragment is simply inert, which is
 * the right failure: it names a position within a page, and a page without that position
 * ignores it.
 */
export const FALLBACK_RETURN_TO = `/home${CONNECTIONS_HASH}`;

/**
 * The URL to come back to — the WHOLE of it below the origin, not just the pathname.
 *
 * The search and the hash are where a host puts the state a bare path cannot carry, and on a
 * console that shows connections in a DIALOG that is the only record that a dialog was open
 * at all. Dropping them sent the visitor back to a page with every dialog closed and no sign
 * the connect had succeeded. What a host does not encode in its URL is still unrecoverable —
 * that is the host's to fix — but nothing is lost here on the way past.
 *
 * The address read itself is `@agentic-toolkit/auth`'s, which is the tier the SSO round-trip
 * asks the same question from; this wrapper only supplies the one thing that is local — what
 * a connect should do when there is no address to name (server render, or a stash written
 * from somewhere without a `window`), which is to come back to the family's own entry point
 * rather than to the string `"undefined"`.
 *
 * Sent through `safeReturnTo` on the way OUT as well as on the way in. The read side already
 * validates, so this is not the only guard — but the two sides are a round-trip through
 * storage anything on this origin can write, and validating only where the value is consumed
 * makes the invariant a property of one caller instead of of the value itself. It is the same
 * function on both sides, so a same-origin address is unchanged by it and there is no second
 * notion of "safe" to keep in agreement.
 */
export function currentReturnTo(): string {
  const here = addressNow();
  return (here && safeReturnTo(here)) || FALLBACK_RETURN_TO;
}

/** Stash the pending-connect context under its `state` before redirecting away. */
export function stashPendingConnect(state: string, ctx: PendingOAuthConnect): void {
  try {
    sessionStorage.setItem(keyFor(state), JSON.stringify(ctx));
  } catch {
    // sessionStorage can be unavailable (private mode / disabled) — the callback
    // will then report a missing context rather than throwing here.
  }
}

/** Read (and validate) the stashed context for a `state`, or null when absent/corrupt. */
export function readPendingConnect(state: string): PendingOAuthConnect | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(keyFor(state));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingOAuthConnect> & { redirectUri?: unknown };
    const method = parsed.authMethod;
    if (!method || !REDIRECT_METHODS.includes(method)) return null;
    // Every field is checked NON-EMPTY, not merely present: each one is sent verbatim to
    // `POST /integrations/connect` (or handed to `router.replace`), where a blank is not a
    // default but a request that cannot succeed — and a stash written with one is corrupt in
    // exactly the way a stash missing the key is. `ecosystemId` was the only one spelled out
    // this way, which made the other three look deliberately laxer than it.
    const filled = (v: unknown): v is string => typeof v === "string" && v.length > 0;
    if (
      !filled(parsed.providerId) ||
      !filled(parsed.serviceType) ||
      !filled(parsed.ecosystemId) ||
      !filled(parsed.returnTo)
    ) {
      return null;
    }
    // `returnTo` is the ONE stashed field that becomes a navigation, and `sessionStorage` is
    // writable by anything that runs on this origin — an injected script, a third-party widget,
    // a stale entry written by an older build. Everything else here is echoed to an API that
    // authorizes it; this one is handed to `router.replace`, so an absolute URL in it is an
    // open redirect at the end of a flow the visitor already trusts.
    //
    // `safeReturnTo` is `@agentic-toolkit/auth`'s, the same choke point the SSO round-trip
    // sends its `returnTo` through: it resolves against this origin and returns only the part
    // below it, so a foreign origin, a protocol-relative `//evil.example`, and a `javascript:`
    // URL all come back null. A stash that fails it is corrupt in exactly the way one with a
    // blank field is — the caller falls back to the address it can rebuild.
    const returnTo = safeReturnTo(parsed.returnTo);
    if (!returnTo) return null;
    const base: PendingConnectBase = {
      providerId: parsed.providerId,
      serviceType: parsed.serviceType,
      ecosystemId: parsed.ecosystemId,
      returnTo,
    };
    if (method === "github_app") return { ...base, authMethod: method };
    // The OAuth pair must carry the exact redirect_uri they sent, so a stash missing it —
    // or carrying a blank one, which the token exchange would reject as a mismatch — is
    // corrupt rather than merely incomplete.
    if (!filled(parsed.redirectUri)) return null;
    return { ...base, authMethod: method, redirectUri: parsed.redirectUri };
  } catch {
    // fall through
  }
  return null;
}

/**
 * Whether a stash was WRITTEN for this `state`, regardless of whether it can be read back.
 *
 * {@link readPendingConnect} answers one question with two very different causes: nothing was
 * ever stored here (a connect begun on another origin — the ordinary case a GitHub App's single
 * Setup URL guarantees), or something was stored and is unusable (a half-written entry, a shape
 * from an older build, a `returnTo` that failed origin validation). The first is recoverable
 * from the signed state and the second is not, and reporting the second as the first sends the
 * visitor round a rebuilt flow that will fail again the same way with no clue why.
 *
 * The raw `getItem` is deliberately unvalidated: presence of the KEY is the whole question.
 */
export function hasPendingConnect(state: string): boolean {
  try {
    return sessionStorage.getItem(keyFor(state)) !== null;
  } catch {
    // No sessionStorage at all — nothing was written here, which is the honest answer.
    return false;
  }
}

const consumedKeyFor = (state: string) => `int-oauth-consumed:${state}`;

/**
 * Record that this `state` was actually SPENT on a connect — a tombstone, left where the stash
 * used to be.
 *
 * Clearing the stash alone cannot distinguish "this callback already ran" from "this callback
 * arrived on an origin that never stashed anything", and the two want opposite handling. A
 * refresh of the callback URL is the common way to reach the first: the backend rejects the
 * second POST of a one-shot credential with a 409, which surfaced to the operator as a raw API
 * error — and to Sentry as an event — for doing nothing more than reloading a page that had
 * already succeeded.
 *
 * The tombstone carries the `returnTo` and NOTHING ELSE of the context. The credential half —
 * the provider, the ecosystem, the service type — is deliberately not kept: the only question
 * left about a spent state is whether it was spent, and storing less means a replay cannot
 * resurrect anything to re-send. The destination is the exception because it is not part of
 * what gets re-sent; it is where the operator was standing when they left, and a replay that
 * recognizes itself but cannot say where to go sends them to the family fallback instead of
 * back to the dialog they started in. Which is the same wrong answer the tombstone exists to
 * stop being given.
 */
export function markPendingConnectConsumed(state: string, returnTo?: string): void {
  try {
    sessionStorage.setItem(consumedKeyFor(state), returnTo ?? "");
  } catch {
    // Without storage a replay is simply unrecognizable — the same position as before.
  }
}

/** Whether {@link markPendingConnectConsumed} already ran for this `state`. */
export function wasPendingConnectConsumed(state: string): boolean {
  try {
    return sessionStorage.getItem(consumedKeyFor(state)) !== null;
  } catch {
    return false;
  }
}

/**
 * Where the connect that spent this `state` came from, or null when the tombstone does not
 * name one.
 *
 * Null covers three cases that want the same answer — no tombstone, a tombstone from a
 * `markPendingConnectConsumed` that had no address to record, and a tombstone left by an
 * OLDER BUILD, whose value was the fixed string `"1"`. That last one is why the leading `/`
 * is required rather than merely preferred: `safeReturnTo("1")` resolves against this origin
 * and hands back `/1` — a real-looking path to a page that does not exist. A tab open across
 * a deploy is the ordinary way to meet one.
 */
export function consumedReturnTo(state: string): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(consumedKeyFor(state));
  } catch {
    return null;
  }
  if (!raw || !raw.startsWith("/")) return null;
  return safeReturnTo(raw) ?? null;
}

/**
 * Clear a consumed entry so a replayed callback can't re-fire it.
 *
 * The tombstone is deliberately NOT cleared here — it is what a replay is recognized by, and it
 * outlives the entry it replaces. Both die with the tab, which is the right lifetime: a signed
 * state is good for ten minutes and a `sessionStorage` origin lives at most as long as the tab.
 */
export function clearPendingConnect(state: string): void {
  try {
    sessionStorage.removeItem(keyFor(state));
  } catch {
    // ignore
  }
}
