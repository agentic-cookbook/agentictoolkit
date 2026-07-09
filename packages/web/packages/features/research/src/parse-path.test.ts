import { describe, it, expect } from "vitest";
import { parseResearchPath } from "./parse-path";

describe("parseResearchPath", () => {
  it("returns the bare list (no docId) with no path segments", () => {
    expect(parseResearchPath(undefined)).toEqual({ docId: undefined });
    expect(parseResearchPath([])).toEqual({ docId: undefined });
  });

  it("maps the first path segment onto docId", () => {
    expect(parseResearchPath(["doc-1"])).toEqual({ docId: "doc-1" });
  });

  it("ignores any segments past the first (the grammar is one level deep)", () => {
    expect(parseResearchPath(["doc-1", "extra"])).toEqual({ docId: "doc-1" });
  });
});
