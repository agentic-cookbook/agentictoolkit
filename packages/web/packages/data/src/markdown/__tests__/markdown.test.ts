import { describe, it, expect } from "vitest";
import { withTags, categoryNodes, tagNodes } from "../markdown";
import type { MarkdownCategoryTreeBody, MarkdownTagSetBody } from "../wire";

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

// The same skew one migration later, and the same rule: the boundary owes the notebook
// rail an array. What is worth pinning is that the fallback is the FLAT LIST and not an
// empty one — `items` carries every category such a backend has, and a category is used
// by NAME everywhere downstream (`?category=<name>` filtering, `slugFor(name, id)`), so
// returning [] would blank a rail whose contents arrived in the very same response.
describe("categoryNodes", () => {
  const old = (items: string[]) => ({ items }) as unknown as MarkdownCategoryTreeBody;

  it("passes real nodes through unchanged (same reference, no needless copy)", () => {
    const res = { items: ["Meetings"], nodes: [{ id: "c1", name: "Meetings", parentId: null, sortOrder: 0 }] };
    expect(categoryNodes(res)).toBe(res.nodes);
  });

  it("prefers nodes even when they are EMPTY — a workspace with no categories is not skew", () => {
    // `items` and `nodes` describe one set: a current backend that sends `nodes: []` sent
    // `items: []` too. Falling back on emptiness rather than absence would be untestable
    // here and identical in effect — but it would rebuild names on a backend that has
    // already answered, which is the wrong reading of a legitimately empty workspace.
    expect(categoryNodes({ items: [], nodes: [] })).toEqual([]);
  });

  it("rebuilds an older backend's flat names as roots, in the order it sent them", () => {
    expect(categoryNodes(old(["Admin", "Meetings", "Reading"]))).toEqual([
      { id: "Admin", name: "Admin", parentId: null, sortOrder: 0 },
      { id: "Meetings", name: "Meetings", parentId: null, sortOrder: 1 },
      { id: "Reading", name: "Reading", parentId: null, sortOrder: 2 },
    ]);
  });

  it("names each rebuilt row by its own name — the only identity such a backend has", () => {
    // A name is unique per owner, so it is a usable key for the rail's fold; and it never
    // travels back, because a flat list has no children and the only write taking an id is
    // `createCategory({ parentId })` on a level the rail cannot publish.
    const [meetings] = categoryNodes(old(["Meetings"]));
    expect(meetings?.id).toBe("Meetings");
    expect(meetings?.name).toBe("Meetings");
  });

  it("yields [] when NEITHER field is an array, rather than throwing", () => {
    expect(categoryNodes({} as unknown as MarkdownCategoryTreeBody)).toEqual([]);
  });
});

// The tag twin of the above. It differs in one way worth pinning: a rebuilt id is the LABEL,
// and the taxonomy door (`/content/keywords/{id}`) takes only row ids — so against such a
// backend a rename or delete fails loudly. What must stay true is that it cannot fail QUIETLY
// by addressing some other row, which holds because real ids are uuids.
describe("tagNodes", () => {
  const old = (items: string[]) => ({ items }) as unknown as MarkdownTagSetBody;

  it("passes real nodes through unchanged (same reference, no needless copy)", () => {
    const res = { items: ["draft"], nodes: [{ id: "k1", label: "draft" }] };
    expect(tagNodes(res)).toBe(res.nodes);
  });

  it("prefers nodes even when they are EMPTY — a workspace with no tags is not skew", () => {
    expect(tagNodes({ items: [], nodes: [] })).toEqual([]);
  });

  it("rebuilds an older backend's flat labels, in the order it sent them", () => {
    expect(tagNodes(old(["alpha", "beta"]))).toEqual([
      { id: "alpha", label: "alpha" },
      { id: "beta", label: "beta" },
    ]);
  });

  it("yields [] when NEITHER field is an array, rather than throwing", () => {
    expect(tagNodes({} as unknown as MarkdownTagSetBody)).toEqual([]);
  });
});
