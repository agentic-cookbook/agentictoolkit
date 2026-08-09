// Unit test for vocabulary.ts — the fold from a project's two stored words to every form the UI
// renders. Pure, so no environment: this file runs in the default node pool, unlike the component
// tests around it.
//
// Three things here are load-bearing and none of them are visible in a screenshot: the PLURAL is
// the author's and never derived, the object IDENTITY is stable (it feeds useMemo deps), and a
// missing/blank word falls back rather than rendering a board with no name for what it holds.
import { describe, it, expect } from "vitest";
import { DEFAULT_ITEM_WORDS, itemWordsOf } from "./vocabulary";

/** Only the two fields `itemWordsOf` reads — it takes a Pick, so a whole Project is noise here. */
const board = (itemNoun: string, itemNounPlural: string) => ({ itemNoun, itemNounPlural });

describe("itemWordsOf — the forms", () => {
  it("caps the leading letter for a label and title-cases the rail heading", () => {
    const w = itemWordsOf(board("story", "stories"));
    expect(w.one).toBe("story");
    expect(w.many).toBe("stories");
    expect(w.oneCap).toBe("Story");
    expect(w.manyCap).toBe("Stories");
    expect(w.manyTitle).toBe("Stories");
  });

  it("title-cases EVERY word of a multi-word plural, and only the first for a label", () => {
    // The default is itself a two-word noun, which is why this distinction exists at all: a rail
    // heading reads "Work Items" while the sentence form reads "Work items".
    expect(DEFAULT_ITEM_WORDS.manyTitle).toBe("Work Items");
    expect(DEFAULT_ITEM_WORDS.manyCap).toBe("Work items");
    expect(DEFAULT_ITEM_WORDS.oneCap).toBe("Work item");
  });

  it("leaves the rest of a word alone, so an acronym survives being used as a label", () => {
    // `cap` must not lower-case the tail. A board tracking "iOS builds" gets "IOS builds" from a
    // naive title-case and that is a visible misspelling of a product name.
    const w = itemWordsOf(board("iOS build", "iOS builds"));
    expect(w.oneCap).toBe("IOS build");
    expect(w.manyCap).toBe("IOS builds");
  });
});

describe("itemWordsOf — count", () => {
  it("uses the STORED plural, which is the whole reason the pair is stored", () => {
    const w = itemWordsOf(board("story", "stories"));
    expect(w.count(1)).toBe("1 story");
    expect(w.count(3)).toBe("3 stories");
    // The `${n === 1 ? "" : "s"}` idiom this replaces would have said "3 storys" here. That is the
    // defect: it is correct for exactly the default noun and wrong for every irregular plural.
    expect(w.count(3)).not.toBe("3 storys");
  });

  it("says none in the plural — zero is not one", () => {
    expect(DEFAULT_ITEM_WORDS.count(0)).toBe("0 work items");
    expect(DEFAULT_ITEM_WORDS.count(1)).toBe("1 work item");
    expect(DEFAULT_ITEM_WORDS.count(2)).toBe("2 work items");
  });
});

describe("itemWordsOf — fallbacks", () => {
  it("gives the defaults before the project has loaded", () => {
    // Both spellings of "not yet": a pane renders its real labels on the first frame and only the
    // renamed minority ever changes a word once the record arrives.
    expect(itemWordsOf(null)).toBe(DEFAULT_ITEM_WORDS);
    expect(itemWordsOf(undefined)).toBe(DEFAULT_ITEM_WORDS);
  });

  it("falls back per WORD, not per project — a half-filled row still reads", () => {
    // The backend refuses an empty rename, so a blank arrived from a row written before the
    // columns existed. Falling back on each side independently keeps the half that IS set.
    expect(itemWordsOf(board("story", "")).many).toBe("work items");
    expect(itemWordsOf(board("story", "")).one).toBe("story");
    expect(itemWordsOf(board("   ", "stories")).one).toBe("work item");
  });

  it("trims a stored word rather than rendering the padding", () => {
    const w = itemWordsOf(board("  story  ", "  stories  "));
    expect(w.one).toBe("story");
    expect(w.count(2)).toBe("2 stories");
  });
});

describe("itemWordsOf — identity", () => {
  it("returns the SAME object for the same pair, so useMemo deps hold", () => {
    // Not a micro-optimisation: these values sit in `useMemo`/`useCallback` dep arrays across the
    // item list and its filters. A fresh object per render invalidates every one of them, and the
    // symptom is a list that re-derives on each keystroke — slow, never wrong, so nothing catches
    // it but this assertion.
    expect(itemWordsOf(board("story", "stories"))).toBe(itemWordsOf(board("story", "stories")));
    // Including the path through the fallbacks, which is what a not-yet-renamed board takes.
    expect(itemWordsOf(board("", ""))).toBe(DEFAULT_ITEM_WORDS);
  });

  it("keys on the PAIR, so two boards sharing a singular stay distinct", () => {
    const a = itemWordsOf(board("spec", "specs"));
    const b = itemWordsOf(board("spec", "specifications"));
    expect(a).not.toBe(b);
    expect(b.count(2)).toBe("2 specifications");
  });
});
