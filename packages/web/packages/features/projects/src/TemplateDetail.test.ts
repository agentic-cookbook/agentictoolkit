// Unit test for the BOARD-SETTINGS half of TemplateDetail's pure folds — the draft → wire body a
// board template carries, and the rules the form refuses before the round trip.
//
// These three settings share one shape and get it right in three different ways, which is exactly
// why they are worth pinning: each scale is omitted at ITS OWN default (and the two defaults sit at
// opposite ends), while the nouns are omitted as a PAIR and refused as a half. A body that carried
// a default would freeze it into every board the template ever stamps out; a body that dropped a
// lone word quietly would look like a rename that saved and did not.
//
// No environment needed — these are functions over a plain draft object, not the component.
import { describe, it, expect } from "vitest";
import { templateBlank, templateToBody, templateValidate, type TemplateDraft } from "./TemplateDetail";

/** A named BOARD template — the kind that carries settings at all. */
function board(over: Partial<TemplateDraft> = {}): TemplateDraft {
  return { ...templateBlank(), kind: "project", name: "Marketing board", ...over };
}

/** The board half of the wire body, which is all these cases are about. */
function bodyOf(draft: TemplateDraft): Record<string, unknown> {
  return templateToBody(draft) as Record<string, unknown>;
}

describe("templateBlank", () => {
  it("starts the nouns BLANK rather than at the platform's words", () => {
    // "" is the template declining to have an opinion, which is a different claim from stamping
    // "work item" onto every board it makes — and it is the one that keeps following the default
    // if that ever moves.
    expect(templateBlank().itemNoun).toBe("");
    expect(templateBlank().itemNounPlural).toBe("");
  });

  it("starts each scale at ITS OWN default, which are opposite ends", () => {
    // Boards rank unless told not to; boards do not estimate unless told to.
    expect(templateBlank().priorityScale).toBe("standard");
    expect(templateBlank().estimateScale).toBe("none");
  });
});

describe("templateToBody — the board settings", () => {
  it("carries NO setting at all when the template has no opinion", () => {
    const b = bodyOf(board());
    expect(b).not.toHaveProperty("priorityScale");
    expect(b).not.toHaveProperty("estimateScale");
    expect(b).not.toHaveProperty("itemNoun");
    expect(b).not.toHaveProperty("itemNounPlural");
  });

  it("omits each scale at its own default and sends it otherwise", () => {
    // The asymmetry is the point: the SAME body shape ("say nothing") is produced by opposite
    // values, so a copy-pasted condition would ship a template that silently un-ranks its boards.
    expect(bodyOf(board({ priorityScale: "none" }))).toMatchObject({ priorityScale: "none" });
    expect(bodyOf(board({ estimateScale: "tshirt" }))).toMatchObject({ estimateScale: "tshirt" });
    expect(bodyOf(board({ priorityScale: "standard" }))).not.toHaveProperty("priorityScale");
    expect(bodyOf(board({ estimateScale: "none" }))).not.toHaveProperty("estimateScale");
  });

  it("sends the nouns as a PAIR, trimmed", () => {
    expect(bodyOf(board({ itemNoun: " story ", itemNounPlural: "  stories" }))).toMatchObject({
      itemNoun: "story",
      itemNounPlural: "stories",
    });
  });

  it("sends NEITHER noun when only one is filled in", () => {
    // The backend 400s a half. `templateValidate` is what a person sees; this is the belt to that
    // brace — a lone singular must never reach the wire even if it somehow got past the form.
    const b = bodyOf(board({ itemNoun: "story" }));
    expect(b).not.toHaveProperty("itemNoun");
    expect(b).not.toHaveProperty("itemNounPlural");
  });
});

describe("templateValidate — the noun pair", () => {
  it("accepts both words, and accepts neither", () => {
    expect(templateValidate(board({ itemNoun: "story", itemNounPlural: "stories" }), [])).toBeNull();
    expect(templateValidate(board(), [])).toBeNull();
  });

  it("refuses a half — in either direction", () => {
    const message = "Give both the singular and plural item name, or neither.";
    expect(templateValidate(board({ itemNoun: "story" }), [])).toBe(message);
    expect(templateValidate(board({ itemNounPlural: "stories" }), [])).toBe(message);
  });

  it("counts a whitespace-only word as absent, not as an answer", () => {
    // Normalised first, so "   " is the same claim as "" — otherwise a stray space would pass the
    // pair check here and be dropped at the body, which is a rename that looks saved and is not.
    expect(templateValidate(board({ itemNoun: "story", itemNounPlural: "   " }), [])).toBe(
      "Give both the singular and plural item name, or neither.",
    );
  });

  it("refuses a word past the stored cap", () => {
    const long = "x".repeat(33);
    expect(templateValidate(board({ itemNoun: long, itemNounPlural: "xs" }), [])).toBe(
      "An item name is too long (32 characters at most).",
    );
    // 32 exactly is the cap, not one past it.
    expect(
      templateValidate(board({ itemNoun: "x".repeat(32), itemNounPlural: "xs" }), []),
    ).toBeNull();
  });

  it("does not apply the board rules to a CARD template", () => {
    // A work_item template returns before the board half — its draft carries blank nouns it never
    // renders, and validating them would refuse a card template for a field it does not have.
    const blank = templateBlank();
    const card: TemplateDraft = {
      ...blank,
      name: "Bug report",
      card: { ...blank.card, title: "Something is broken" },
      itemNoun: "story",
    };
    expect(templateValidate(card, [])).toBeNull();
  });
});
