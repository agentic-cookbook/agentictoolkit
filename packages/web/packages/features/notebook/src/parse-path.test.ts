import { describe, it, expect } from "vitest";
import { NOTE_SEPARATOR, notebookSegments, parseNotebookPath } from "./parse-path";

describe("parseNotebookPath", () => {
  it("returns the whole notebook with no path segments", () => {
    expect(parseNotebookPath(undefined)).toEqual({ categorySlugs: [] });
    expect(parseNotebookPath([])).toEqual({ categorySlugs: [] });
  });

  it("reads a bare chain as categories, however deep", () => {
    expect(parseNotebookPath(["work"])).toEqual({ categorySlugs: ["work"] });
    expect(parseNotebookPath(["work", "meetings", "q3"])).toEqual({
      categorySlugs: ["work", "meetings", "q3"],
    });
  });

  it("reads a note opened at the notebook root", () => {
    expect(parseNotebookPath([NOTE_SEPARATOR, "note-1"])).toEqual({
      categorySlugs: [],
      noteId: "note-1",
    });
  });

  it("splits a chain from the note the separator introduces", () => {
    expect(parseNotebookPath(["work", "meetings", NOTE_SEPARATOR, "note-1"])).toEqual({
      categorySlugs: ["work", "meetings"],
      noteId: "note-1",
    });
  });

  it("reports no note when the separator is the last segment", () => {
    // A truncated URL: the separator promises an id that isn't there. The chain still
    // resolves, so the user lands on the category rather than on an error.
    expect(parseNotebookPath(["work", NOTE_SEPARATOR])).toEqual({
      categorySlugs: ["work"],
      noteId: undefined,
    });
  });

  it("ignores anything past the note id (the grammar ends there)", () => {
    expect(parseNotebookPath([NOTE_SEPARATOR, "note-1", "extra"])).toEqual({
      categorySlugs: [],
      noteId: "note-1",
    });
  });

  it("drops empty segments rather than treating them as a category", () => {
    expect(parseNotebookPath(["", "work", ""])).toEqual({ categorySlugs: ["work"] });
  });
});

describe("notebookSegments", () => {
  it("round-trips every shape the parser accepts", () => {
    for (const selection of [
      { categorySlugs: [] },
      { categorySlugs: ["work"] },
      { categorySlugs: ["work", "meetings", "q3"] },
      { categorySlugs: [], noteId: "note-1" },
      { categorySlugs: ["work", "meetings"], noteId: "note-1" },
    ]) {
      const segments = notebookSegments(selection.categorySlugs, selection.noteId);
      expect(parseNotebookPath(segments)).toEqual({
        categorySlugs: selection.categorySlugs,
        ...(selection.noteId ? { noteId: selection.noteId } : {}),
      });
    }
  });

  it("omits the separator entirely when no note is open", () => {
    // Not merely cosmetic: a trailing separator would be a second URL for the same view.
    expect(notebookSegments(["work"], null)).toEqual(["work"]);
    expect(notebookSegments([], undefined)).toEqual([]);
  });

  it("emits the separator before the note id", () => {
    expect(notebookSegments(["work"], "note-1")).toEqual(["work", NOTE_SEPARATOR, "note-1"]);
  });
});
