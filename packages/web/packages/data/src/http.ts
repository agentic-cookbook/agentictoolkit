"use client";

// Auth HTTP logic now lives in @agentic-toolkit/auth. Re-exported here so the
// app's api modules keep importing from "./http". (SSO code exchange stays
// host-side, so the toolkit auth client omits it and it is not re-exported.)
export {
  authedJson,
  authedRequest,
  extractErrorMessage,
  readErrorMessage,
  tokensFromResponse,
  readAccessToken,
  readTokenSubject,
  type BackendTokenFields,
} from "@agentic-toolkit/auth/client";

/** The HTTP status a thrown error carries, when it is a status-carrying HTTP
 *  error, else undefined. Duck-typed on a numeric `.status` rather than
 *  `instanceof` one AuthHttpError class: a host may layer its own auth client
 *  atop this package (so TWO distinct AuthHttpError classes coexist), and the
 *  predicates below must recognize both. Anchored on Error so arbitrary
 *  `{status}` shapes don't match. */
export function httpStatus(err: unknown): number | undefined {
  if (!(err instanceof Error)) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/**
 * A refusal the shared error reporter DROPS — for the checks a client makes BEFORE it
 * reaches the backend, whose message is meant for the operator and no one else.
 *
 * The dialogs and forms in `@agentic-toolkit/resource` hand every error they catch to
 * `reportUnexpectedAuthError`, whose gate keeps only errors with NO numeric `status` or a
 * 5xx one — a network failure or a backend outage. A plain `new Error("pick a game first")`
 * has no status, so it passes that gate and files an operator's mis-click in production
 * telemetry as an outage. Giving the refusal a 4xx says what it is in the one vocabulary
 * the gate reads.
 *
 * `status` defaults to 400 and takes any 4xx the situation fits better (409 for a
 * conflicting local state, 422 for an unusable input).
 */
export function clientRefusal(message: string, status = 400): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** True if `err` is a backend 404 (a status-carrying HTTP error with status 404). */
export function isNotFound(err: unknown): boolean {
  return httpStatus(err) === 404;
}

/** The error's message when it has one, else `fallback` — for inline "couldn't X" states. */
export function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** True if `err` is a backend 409 conflict (a status-carrying HTTP error with
 *  status 409) — e.g. a public route already claimed by another of the caller's
 *  papers. Status-based so it doesn't depend on the message text. */
export function isConflict(err: unknown): boolean {
  return httpStatus(err) === 409;
}

/** True if `err` is a backend 403 (a status-carrying HTTP error with status 403) —
 *  e.g. an ecosystem-scoped route addressed with an ecosystemId that isn't the caller's
 *  own ecosystem. Surfaced as a clear inline state rather than a crash. */
export function isForbidden(err: unknown): boolean {
  return httpStatus(err) === 403;
}

/** True if `err` is a backend 503 (a status-carrying HTTP error with status 503) —
 *  e.g. an integration "sync now" issued for a provider that has no worker
 *  registered yet. Retryable once the capability ships, so it is shown as an
 *  inline note rather than a hard error. */
export function isServiceUnavailable(err: unknown): boolean {
  return httpStatus(err) === 503;
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
