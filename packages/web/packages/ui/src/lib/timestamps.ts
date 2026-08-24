/**
 * Rendering the backend's timestamps, which are NOT all ISO strings.
 *
 * Postgres `timestamp` columns come back through Drizzle's `mode: 'string'` as
 * `YYYY-MM-DD HH:MM:SS[.ffffff]` — a space instead of the `T`, and NO zone suffix. `new Date()`
 * parses that shape as LOCAL time, while the value is UTC, so every such column renders shifted by
 * the viewer's offset: west of UTC a row created just after midnight shows the previous day, and
 * "held since" on the Reserved Identifiers page reads as a date that has not happened yet in Asia.
 * Values that already carry a zone (`Z`, `+01:00`) or a `T` are left exactly as they are — those
 * come from `new Date().toISOString()` on the server and are already unambiguous.
 *
 * One module rather than a fix at each call site: the rule is a property of the TRANSPORT and not
 * of any one page, so every surface that renders a backend timestamp needs it — the admin site's
 * four such pages and the ecosystem panes alike — and a page that forgets it is wrong in a way
 * nobody notices until a bug report from another timezone.
 */

/** `YYYY-MM-DD HH:MM:SS` with no zone — the shape that needs a `Z` before `Date` sees it. */
const NAIVE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/** A `Date` for a backend timestamp, or null when the value is not a timestamp at all. */
export function parseBackendTimestamp(value: string): Date | null {
  const normalized = NAIVE.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A date, in the viewer's locale. `fallback` is returned for anything unparseable — showing the raw
 * value would be noise in a narrow column, and "Invalid Date" is worse than an em dash.
 */
export function formatDate(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const d = parseBackendTimestamp(value);
  return d ? d.toLocaleDateString() : fallback;
}

/** A date and time, in the viewer's locale. Unparseable values fall back to the raw string, which
 *  in a wide column is more useful to an operator than an em dash. */
export function formatDateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const d = parseBackendTimestamp(value);
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : value;
}
