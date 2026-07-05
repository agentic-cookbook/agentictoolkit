import { describe, it, expect, beforeEach } from "vitest";
import { readSearchParam, writeSearchParams } from "../lib/search-params";

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
});
