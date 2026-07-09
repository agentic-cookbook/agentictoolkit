import { describe, it, expect } from "vitest";
import { withTags } from "../markdown";

// Regression: the ResearchPane crashed ("tags is not iterable" / reading `length`
// of undefined) when a document arrived without a `tags` array — which happens
// when the backend deploy is OLDER than this frontend (before the category/tags
// migration). The API boundary must guarantee `tags` is always an array.
describe("withTags", () => {
  it("defaults a missing tags field to []", () => {
    const doc = { id: "d1", title: "Doc" } as unknown as { id: string; title: string; tags: string[] };
    expect(withTags(doc).tags).toEqual([]);
  });

  it("defaults a null tags field to []", () => {
    const doc = { id: "d1", tags: null } as unknown as { id: string; tags: string[] };
    expect(withTags(doc).tags).toEqual([]);
  });

  it("passes a real array through unchanged (same reference, no needless copy)", () => {
    const doc = { id: "d1", tags: ["a", "b"] };
    expect(withTags(doc)).toBe(doc);
  });

  it("preserves the other fields when defaulting", () => {
    const doc = { id: "d1", title: "Doc" } as unknown as { id: string; title: string; tags: string[] };
    expect(withTags(doc)).toMatchObject({ id: "d1", title: "Doc", tags: [] });
  });
});
