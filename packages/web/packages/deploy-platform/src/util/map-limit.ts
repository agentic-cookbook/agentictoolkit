/**
 * Run `fn` over `items` with at most `limit` in flight; results keep input order.
 *
 * Use this instead of `Promise.all(items.map(fn))` whenever the work touches a
 * shared, contended resource (sockets, DNS, an upstream API's rate limit). An
 * unbounded fan-out makes every task's wall-clock time include the time it spent
 * queued behind the others — which silently corrupts any *per-task* timing the
 * work measures (e.g. a health probe's response time).
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
