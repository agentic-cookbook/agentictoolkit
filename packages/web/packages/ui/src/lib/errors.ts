/** The human-readable message of a thrown value (the authed client throws
 *  Error(message) on non-2xx). One home for the coercion every async surface
 *  needs. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
