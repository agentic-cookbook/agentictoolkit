import { describe, expect, it } from "vitest";
import { cachedSingleFlight } from "./cached-single-flight.js";

describe("cachedSingleFlight", () => {
  it("caches within TTL and dedupes concurrent calls", async () => {
    let calls = 0;
    const get = cachedSingleFlight(10_000, async () => ++calls);
    const [a, b] = await Promise.all([get(), get()]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(await get()).toBe(1);
    expect(calls).toBe(1);
  });

  it("fresh=true bypasses the cache", async () => {
    let calls = 0;
    const get = cachedSingleFlight(10_000, async () => ++calls);
    await get();
    expect(await get(true)).toBe(2);
  });

  it("a rejected build is not cached", async () => {
    let calls = 0;
    const get = cachedSingleFlight(10_000, async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return calls;
    });
    await expect(get()).rejects.toThrow("boom");
    expect(await get()).toBe(2);
  });
});
