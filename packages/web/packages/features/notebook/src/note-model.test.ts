// The draft → wire mapping. Everything here is pure, and the cases that matter are the ones
// where an EMPTY field has to mean something specific: the create and update bodies disagree
// on purpose, and getting that wrong is invisible until a user clears a field and watches it
// come back.
import { describe, expect, it } from "vitest";
import {
  noteBlank,
  noteDiffers,
  noteNormalize,
  noteToInput,
  noteValidate,
  normalizeTags,
  tagsOf,
  toCreateBody,
  toUpdateBody,
  type NoteInput,
} from "./note-model";

const draft = (patch: Partial<NoteInput> = {}): NoteInput => ({
  title: "Standup",
  content: "# Standup\n\nnotes",
  category: "Work",
  tags: ["meeting"],
  ...patch,
});

describe("toCreateBody", () => {
  it("omits an empty title and category so the backend derives/leaves them", () => {
    expect(toCreateBody(draft({ title: "", category: "", tags: [] }))).toEqual({
      content: "# Standup\n\nnotes",
    });
  });

  it("sends every field that carries a value", () => {
    expect(toCreateBody(draft())).toEqual({
      content: "# Standup\n\nnotes",
      title: "Standup",
      category: "Work",
      tags: ["meeting"],
    });
  });
});

describe("toUpdateBody", () => {
  it("sends a cleared title as an empty string, not as an omission", () => {
    // The defect this pins: omitted reads as UNCHANGED on the backend, so a title the user
    // cleared came back filled in on the save's own response, under the cursor, with nothing
    // in the UI to explain it. Empty means "re-derive from the content" — what a create does.
    const body = toUpdateBody(draft({ title: "" }));
    expect(body.title).toBe("");
    expect("title" in body).toBe(true);
  });

  it("sends a cleared category as null, which is what CLEARS it", () => {
    expect(toUpdateBody(draft({ category: "" })).category).toBeNull();
  });

  it("always sends the full draft — this editor has no partial save", () => {
    expect(toUpdateBody(draft())).toEqual({
      content: "# Standup\n\nnotes",
      title: "Standup",
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
  it("trims the title and category but leaves the body byte-exact", () => {
    const out = noteNormalize(draft({ title: "  Standup  ", category: " Work ", content: "  x  \n" }));
    expect(out.title).toBe("Standup");
    expect(out.category).toBe("Work");
    expect(out.content).toBe("  x  \n");
  });
});

describe("noteValidate", () => {
  it("requires a body", () => {
    expect(noteValidate(draft({ content: "   " }))).toBe("A note body is required.");
  });

  it("accepts a note with no title or category", () => {
    expect(noteValidate(draft({ title: "", category: "" }))).toBeNull();
  });

  it("enforces the backend's own field limits", () => {
    expect(noteValidate(draft({ title: "x".repeat(501) }))).toMatch(/500 characters/);
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
    for (const patch of [{ title: "x" }, { content: "x" }, { category: "x" }, { tags: [] }]) {
      expect(noteDiffers(draft(patch), draft())).toBe(true);
    }
  });
});

describe("noteToInput / noteBlank", () => {
  it("maps a null category to the empty string the editor binds to", () => {
    const input = noteToInput({ title: "T", content: "C", category: null, tags: ["a"] } as never);
    expect(input).toEqual({ title: "T", content: "C", category: "", tags: ["a"] });
  });

  it("round-trips a blank draft through the create body as content-only", () => {
    expect(toCreateBody({ ...noteBlank(), content: "x" })).toEqual({ content: "x" });
  });
});

describe("tagsOf", () => {
  it("collects distinct tags across notes, locale-sorted", () => {
    expect(tagsOf([{ tags: ["b", "a"] }, { tags: ["a", "c"] }])).toEqual(["a", "b", "c"]);
  });
});
