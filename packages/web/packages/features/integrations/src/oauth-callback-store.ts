"use client";

// The redirect round-trip loses React state (the browser leaves the app and comes back
// on a fresh page load), so the connect flow stashes the context it will need on return
// in `sessionStorage`, KEYED BY the signed `state` the start endpoint returned. The
// callback reads `state` from the query, looks the context up, finishes the connect with
// whatever credential the provider sent back beside it, and clears the entry. Keying by
// `state` (not a fixed key) keeps two in-flight connects from clobbering each other and
// ties the stash to the exact CSRF token the provider echoes back.

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
    if (
      typeof parsed.providerId !== "string" ||
      typeof parsed.serviceType !== "string" ||
      typeof parsed.ecosystemId !== "string" ||
      parsed.ecosystemId.length === 0 ||
      typeof parsed.returnTo !== "string"
    ) {
      return null;
    }
    const base: PendingConnectBase = {
      providerId: parsed.providerId,
      serviceType: parsed.serviceType,
      ecosystemId: parsed.ecosystemId,
      returnTo: parsed.returnTo,
    };
    if (method === "github_app") return { ...base, authMethod: method };
    // The OAuth pair must carry the exact redirect_uri they sent, so a stash missing it is
    // corrupt rather than merely incomplete.
    if (typeof parsed.redirectUri !== "string") return null;
    return { ...base, authMethod: method, redirectUri: parsed.redirectUri };
  } catch {
    // fall through
  }
  return null;
}

/** Clear a consumed entry so a replayed callback can't re-fire it. */
export function clearPendingConnect(state: string): void {
  try {
    sessionStorage.removeItem(keyFor(state));
  } catch {
    // ignore
  }
}
