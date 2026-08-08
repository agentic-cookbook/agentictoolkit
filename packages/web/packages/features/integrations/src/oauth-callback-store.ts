"use client";

// The OAuth redirect round-trip loses React state (the browser leaves the app and
// comes back on a fresh page load), so the connect flow stashes the context it will
// need on return in `sessionStorage`, KEYED BY the signed `state` the start endpoint
// returned. The callback reads `code` + `state` from the query, looks the context up,
// finishes the connect, and clears the entry. Keying by `state` (not a fixed key)
// keeps two in-flight connects from clobbering each other and ties the stash to the
// exact CSRF token the provider echoes back.

/** The auth methods that use the browser-redirect round-trip. */
export type RedirectAuthMethod = "oauth" | "oauth_instance";

export interface PendingOAuthConnect {
  /** Which connect branch to finish on return. */
  authMethod: RedirectAuthMethod;
  providerId: string;
  serviceType: string;
  /** The ecosystem the connection belongs to — sent as `ecosystemId` on the connect that
   *  finishes this flow; the backend authorizes the caller against it. Required. */
  ecosystemId: string;
  /** The exact `redirect_uri` sent to the start endpoint; oauth connect must echo it. */
  redirectUri: string;
  /** Where to route back to (the integrations topic detail) once connected. */
  returnTo: string;
}

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
    const parsed = JSON.parse(raw) as Partial<PendingOAuthConnect>;
    if (
      (parsed.authMethod === "oauth" || parsed.authMethod === "oauth_instance") &&
      typeof parsed.providerId === "string" &&
      typeof parsed.serviceType === "string" &&
      typeof parsed.ecosystemId === "string" &&
      parsed.ecosystemId.length > 0 &&
      typeof parsed.redirectUri === "string" &&
      typeof parsed.returnTo === "string"
    ) {
      return {
        authMethod: parsed.authMethod,
        providerId: parsed.providerId,
        serviceType: parsed.serviceType,
        ecosystemId: parsed.ecosystemId,
        redirectUri: parsed.redirectUri,
        returnTo: parsed.returnTo,
      };
    }
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
