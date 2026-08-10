// The draft → wire mapping, plus the fold that turns the rail's scope and the bar's filter
// into one list request. Everything here is pure, and the cases that matter are the ones where
// an EMPTY field has to mean something specific: the create and update bodies disagree on
// purpose, and getting that wrong is invisible until a user clears a field and watches it come
// back.
import { describe, expect, it } from "vitest";
import {
  noteBlank,
  noteDiffers,
  noteNormalize,
  noteToInput,
  noteValidate,
  normalizeTags,
  resolveListCategory,
  tagsOf,
  toCreateBody,
  toUpdateBody,
  type NoteInput,
} from "./note-model";

const draft = (patch: Partial<NoteInput> = {}): NoteInput => ({
  content: "# Standup\n\nnotes",
  category: "Work",
  tags: ["meeting"],
  ...patch,
});

describe("the draft has no title", () => {
  it("carries only the body and its classification", () => {
    // Pins the shape rather than a behaviour: the title IS the body's first line, derived by
    // the backend so every client shows the same one. A `title` key reappearing here is how a
    // second, drifting name gets re-introduced.
    expect(Object.keys(noteBlank()).sort()).toEqual(["category", "content", "tags"]);
  });
});

describe("toCreateBody", () => {
  it("omits an empty category and tag list so the backend leaves them unset", () => {
    expect(toCreateBody(draft({ category: "", tags: [] }))).toEqual({
      content: "# Standup\n\nnotes",
    });
  });

  it("sends every field that carries a value", () => {
    expect(toCreateBody(draft())).toEqual({
      content: "# Standup\n\nnotes",
      category: "Work",
      tags: ["meeting"],
    });
  });
});

describe("toUpdateBody", () => {
  it("sends a cleared category as null, which is what CLEARS it", () => {
    expect(toUpdateBody(draft({ category: "" })).category).toBeNull();
  });

  it("always sends the full draft — this editor has no partial save", () => {
    expect(toUpdateBody(draft())).toEqual({
      content: "# Standup\n\nnotes",
      category: "Work",
      tags: ["meeting"],
    });
  });

  it("sends an empty tag list rather than dropping the field", () => {
    // Same rule as the category: omitted would leave the old tags in place, so clearing the
    // last tag has to be expressible.
    expect(toUpdateBody(draft({ tags: [] })).tags).toEqual([]);
  });
});

describe("normalizeTags", () => {
  it("trims, drops empties and dedupes in first-seen order", () => {
    expect(normalizeTags([" b ", "a", "", "  ", "b", "a"])).toEqual(["b", "a"]);
  });
});

describe("noteNormalize", () => {
  it("trims the category but leaves the body byte-exact", () => {
    const out = noteNormalize(draft({ category: " Work ", content: "  x  \n" }));
    expect(out.category).toBe("Work");
    expect(out.content).toBe("  x  \n");
  });
});

describe("noteValidate", () => {
  it("requires a body", () => {
    // The note's whole identity is its text — with none, there is no title either. This is
    // also what stops a note being CREATED in a state that can never be saved again.
    expect(noteValidate(draft({ content: "   " }))).toBe("A note body is required.");
  });

  it("accepts a note with no category and no tags", () => {
    expect(noteValidate(draft({ category: "", tags: [] }))).toBeNull();
  });

  it("enforces the backend's own category limit", () => {
    expect(noteValidate(draft({ category: "x".repeat(201) }))).toMatch(/200 characters/);
  });
});

describe("noteDiffers", () => {
  it("is false for a draft equal to its baseline", () => {
    expect(noteDiffers(draft(), draft())).toBe(false);
  });

  it("sees a reordered tag list as a change", () => {
    expect(noteDiffers(draft({ tags: ["a", "b"] }), draft({ tags: ["b", "a"] }))).toBe(true);
  });

  it("sees each field", () => {
    // The reported defect: adding a tag or a category left Save disabled. Whatever else is
    // wrong, the dirty check has to notice both.
    for (const patch of [{ content: "x" }, { category: "x" }, { tags: [] }, { tags: ["m", "n"] }]) {
      expect(noteDiffers(draft(patch), draft())).toBe(true);
    }
  });
});

describe("noteToInput / noteBlank", () => {
  it("maps a null category to the empty string the editor binds to", () => {
    const input = noteToInput({ content: "C", category: null, tags: ["a"] } as never);
    expect(input).toEqual({ content: "C", category: "", tags: ["a"] });
  });

  it("round-trips a blank draft through the create body as content-only", () => {
    expect(toCreateBody({ ...noteBlank(), content: "x" })).toEqual({ content: "x" });
  });
});

describe("resolveListCategory", () => {
  const all = { kind: "all" } as const;
  const none = { kind: "uncategorized" } as const;
  const work = { kind: "named", name: "Work" } as const;

  it("asks for nothing when the whole notebook is showing", () => {
    expect(resolveListCategory(all, "")).toEqual({
      query: "",
      uncategorizedOnly: false,
      empty: false,
    });
  });

  it("lets the bar narrow an unscoped list", () => {
    expect(resolveListCategory(all, "Work").query).toBe("Work");
  });

  it("asks for the rail's category when the bar is not narrowing", () => {
    expect(resolveListCategory(work, "").query).toBe("Work");
  });

  it("keeps ONE query when both axes name the same category", () => {
    // Case-insensitively the same place. Sending it once is not a shortcut — `?category=` takes
    // one value, so the alternative is choosing which spelling to send.
    expect(resolveListCategory(work, "work")).toEqual({
      query: "Work",
      uncategorizedOnly: false,
      empty: false,
    });
  });

  it("reports the contradiction instead of letting one axis win", () => {
    // A note has exactly one category, so "in Work" ∩ "in Personal" is empty. The honest answer
    // is no notes; silently showing one of the two would look like a filter that half works.
    expect(resolveListCategory(work, "Personal").empty).toBe(true);
  });

  it("filters uncategorized on the client, because the backend has no parameter for it", () => {
    expect(resolveListCategory(none, "")).toEqual({
      query: "",
      uncategorizedOnly: true,
      empty: false,
    });
  });

  it("treats uncategorized narrowed to a category as empty", () => {
    expect(resolveListCategory(none, "Work").empty).toBe(true);
  });

  it("ignores surrounding whitespace in the filter", () => {
    expect(resolveListCategory(all, "  ").query).toBe("");
    expect(resolveListCategory(none, "   ").uncategorizedOnly).toBe(true);
  });
});

describe("tagsOf", () => {
  it("collects distinct tags across notes, locale-sorted", () => {
    expect(tagsOf([{ tags: ["b", "a"] }, { tags: ["a", "c"] }])).toEqual(["a", "b", "c"]);
  });
});
