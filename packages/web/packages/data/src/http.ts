"use client";

// Auth HTTP logic now lives in @agentic-toolkit/auth. Re-exported here so the
// app's api modules keep importing from "./http". (SSO code exchange stays
// host-side, so the toolkit auth client omits it and it is not re-exported.)
import { AuthHttpError } from "@agentic-toolkit/auth/client";
export {
  authedJson,
  authedRequest,
  extractErrorMessage,
  readErrorMessage,
  tokensFromResponse,
  readAccessToken,
  type BackendTokenFields,
} from "@agentic-toolkit/auth/client";

/** True if `err` is a backend 404 (an {@link AuthHttpError} carrying status 404). */
export function isNotFound(err: unknown): boolean {
  return err instanceof AuthHttpError && err.status === 404;
}

/** The error's message when it has one, else `fallback` — for inline "couldn't X" states. */
export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** True if `err` is a backend 409 conflict (an {@link AuthHttpError} carrying
 *  status 409) — e.g. a public route already claimed by another of the caller's
 *  papers. Status-based so it doesn't depend on the message text. */
export function isConflict(err: unknown): boolean {
  return err instanceof AuthHttpError && err.status === 409;
}

/** True if `err` is a backend 403 (an {@link AuthHttpError} carrying status 403) —
 *  e.g. an ecosystem-scoped route addressed with an ecosystemId that isn't the caller's
 *  own ecosystem. Surfaced as a clear inline state rather than a crash. */
export function isForbidden(err: unknown): boolean {
  return err instanceof AuthHttpError && err.status === 403;
}

/** True if `err` is a backend 503 (an {@link AuthHttpError} carrying status 503) —
 *  e.g. an integration "sync now" issued for a provider that has no worker
 *  registered yet. Retryable once the capability ships, so it is shown as an
 *  inline note rather than a hard error. */
export function isServiceUnavailable(err: unknown): boolean {
  return err instanceof AuthHttpError && err.status === 503;
}

/**
 * Map a backend uniqueness conflict to a friendly, entity-named error. Generic
 * CRUD answers a duplicate row or identifier with HTTP 409 and a message that
 * contains "already exists" (authedJson throws an Error carrying that message).
 * In a create/update `catch`, pass the error here: a conflict is rethrown as
 * `friendly`, anything else is rethrown unchanged.
 *
 * This replaces racy, scope- and soft-delete-blind pre-read checks: the DB
 * unique index is the real guard, and a pre-read can't see a soft-deleted row
 * that still occupies the unique key. Returns `never` — it always throws.
 */
export function rethrowConflict(err: unknown, friendly: string): never {
  if (err instanceof Error && /already exists/i.test(err.message)) {
    throw new Error(friendly);
  }
  throw err;
}
