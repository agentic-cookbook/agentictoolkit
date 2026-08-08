import { isForbidden } from "@agentic-toolkit/data";

/**
 * Build a section's error formatter: a 403 becomes that section's own sentence, anything else
 * shows the server's message, and an unrecognisable throw falls back to the caller's string.
 *
 * A factory rather than a three-argument function because the forbidden sentence is a property of
 * the SECTION ("…this realm's catalog", "…this realm's event types"), not of the call site — the
 * hub had it hard-coded once per editor file, which is exactly the thing that drifts once a third
 * section appears. Each section binds it once at module scope and calls it with (err, fallback),
 * so every call site reads the same as it did before the split.
 */
export function forbiddenAware(forbiddenMessage: string) {
  return function errText(err: unknown, fallback: string): string {
    if (isForbidden(err)) return forbiddenMessage;
    return err instanceof Error ? err.message : fallback;
  };
}
