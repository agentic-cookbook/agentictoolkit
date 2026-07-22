/**
 * An AbortSignal that fires after `ms`, with a `done()` to clear the timer —
 * call it in a finally so completed requests don't leave timers pending.
 * The ONE timeout helper for outbound checks (shared by the API routes).
 */
export function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(t) };
}
