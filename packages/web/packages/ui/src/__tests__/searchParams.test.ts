import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readSearchParam,
  writeSearchParams,
  subscribeToSearchParams,
} from "../lib/search-params";

describe("search-params", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/board");
  });

  it("readSearchParam returns the value, or null when absent", () => {
    window.history.replaceState(null, "", "/board?topic=abc");
    expect(readSearchParam("topic")).toBe("abc");
    expect(readSearchParam("missing")).toBeNull();
  });

  it("writeSearchParams SETS a non-null value and DELETES on null", () => {
    writeSearchParams({ topic: "x" });
    expect(readSearchParam("topic")).toBe("x");
    expect(window.location.search).toBe("?topic=x");

    writeSearchParams({ topic: null });
    expect(readSearchParam("topic")).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("writeSearchParams handles multiple keys and preserves unrelated params", () => {
    window.history.replaceState(null, "", "/settings?keep=1");
    writeSearchParams({ tab: "services", persona: "p-1", empty: null });
    expect(readSearchParam("keep")).toBe("1"); // untouched
    expect(readSearchParam("tab")).toBe("services");
    expect(readSearchParam("persona")).toBe("p-1");
    expect(readSearchParam("empty")).toBeNull();
  });

  // The whole reason the store exists: `history.replaceState` fires no event, so without these a
  // param written by one component is invisible to every other reader of the same key — and the
  // defect looks exactly like a stale render.
  describe("subscribeToSearchParams", () => {
    it("notifies on a write, and stops after unsubscribe", () => {
      const seen = vi.fn();
      const unsubscribe = subscribeToSearchParams(seen);

      writeSearchParams({ item: "w1" });
      expect(seen).toHaveBeenCalledTimes(1);

      writeSearchParams({ item: null });
      expect(seen).toHaveBeenCalledTimes(2);

      unsubscribe();
      writeSearchParams({ item: "w2" });
      expect(seen).toHaveBeenCalledTimes(2);
      // Still written — unsubscribing silences the listener, it does not disarm the writer.
      expect(readSearchParam("item")).toBe("w2");
    });

    it("notifies EVERY subscriber, which is what lets two components share one param", () => {
      const a = vi.fn();
      const b = vi.fn();
      const offA = subscribeToSearchParams(a);
      const offB = subscribeToSearchParams(b);

      writeSearchParams({ item: "w1" });
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);

      offA();
      offB();
    });

    it("notifies on popstate — Back changes the same params a write does", () => {
      const seen = vi.fn();
      const unsubscribe = subscribeToSearchParams(seen);

      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(seen).toHaveBeenCalledTimes(1);

      unsubscribe();
      // The binding is refcounted by the listener set: with the last subscriber gone the window
      // listener goes too, so a navigation on a page that watches nothing costs nothing.
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(seen).toHaveBeenCalledTimes(1);
    });

    it("survives a listener that unsubscribes itself while reacting", () => {
      const later = vi.fn();
      const off: Array<() => void> = [];
      off.push(
        subscribeToSearchParams(() => {
          off[0]?.();
        }),
      );
      off.push(subscribeToSearchParams(later));

      writeSearchParams({ item: "w1" });
      // The second listener still ran — iteration is over a copy, so removing one mid-notify does
      // not make the set skip the next.
      expect(later).toHaveBeenCalledTimes(1);
      off[1]?.();
    });
  });
});
