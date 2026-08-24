import { describe, it, expect } from "vitest";
import { parseResearchPath, researchSegments } from "./parse-path";

const SEP = "-";

describe("parseResearchPath", () => {
  it("returns the bare list with no path segments", () => {
    expect(parseResearchPath(undefined)).toEqual({ categorySlugs: [] });
    expect(parseResearchPath([])).toEqual({ categorySlugs: [] });
  });

  it("reads a bare chain as categories, nothing open", () => {
    expect(parseResearchPath(["work"])).toEqual({ categorySlugs: ["work"] });
    expect(parseResearchPath(["work", "reports", "q3"])).toEqual({
      categorySlugs: ["work", "reports", "q3"],
    });
  });

  it("splits a chain from the document the separator introduces", () => {
    expect(parseResearchPath(["work", "reports", SEP, "doc-1"])).toEqual({
      categorySlugs: ["work", "reports"],
      docId: "doc-1",
    });
  });

  it("reads a document opened with no chain (uncategorised)", () => {
    expect(parseResearchPath([SEP, "doc-1"])).toEqual({ categorySlugs: [], docId: "doc-1" });
  });

  it("treats a chain segment that is itself the separator as where the chain ends, not as a category named '-'", () => {
    // `slugify` can never emit a bare `-` for a real category name, so a `-` anywhere in the
    // segments is always the separator — even one sitting in the middle of what looks like a
    // deeper chain.
    expect(parseResearchPath(["work", SEP, "doc-1"])).toEqual({
      categorySlugs: ["work"],
      docId: "doc-1",
    });
  });

  it("reports no document open when the separator is the last segment", () => {
    // A truncated URL: the separator promises an id that isn't there. The chain still
    // resolves, so the user lands on the category rather than on an error.
    expect(parseResearchPath(["work", SEP])).toEqual({ categorySlugs: ["work"] });
    expect(parseResearchPath([SEP])).toEqual({ categorySlugs: [] });
  });

  it("round-trips every shape the parser accepts", () => {
    for (const selection of [
      { categorySlugs: [] },
      { categorySlugs: ["work"] },
      { categorySlugs: ["work", "reports", "q3"] },
      { categorySlugs: [], docId: "doc-1" },
      { categorySlugs: ["work", "reports"], docId: "doc-1" },
    ]) {
      const segments = researchSegments(selection.categorySlugs, selection.docId);
      expect(parseResearchPath(segments)).toEqual({
        categorySlugs: selection.categorySlugs,
        ...(selection.docId ? { docId: selection.docId } : {}),
      });
    }
  });
});

describe("researchSegments", () => {
  it("omits the separator entirely when no document is open", () => {
    // Not merely cosmetic: a trailing separator would be a second URL for the same view.
    expect(researchSegments(["work"], null)).toEqual(["work"]);
    expect(researchSegments([], undefined)).toEqual([]);
  });

  it("emits the separator before the document id", () => {
    expect(researchSegments(["work"], "doc-1")).toEqual(["work", SEP, "doc-1"]);
    expect(researchSegments([], "doc-1")).toEqual([SEP, "doc-1"]);
  });
});
