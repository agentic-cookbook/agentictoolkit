// The create form's address derivation. A product's rdid is `<parent rdid>.<slug>`,
// where the parent is the workspace's own (infrastructure) ecosystem — so the preview
// here must equal what the server derives by walking the new row's parent chain, and
// must show NOTHING while the parent is still unresolved.
import { describe, it, expect } from "vitest";
import {
  ecoCreateBlank,
  ecoCreatePrefix,
  ecoCreateRdid,
  ecoCreateSlugValid,
  ecoCreateToInput,
  ecoCreateValidate,
  ECOSYSTEM_SLUG_MAX_LENGTH,
} from "./EcosystemForm";

describe("ecoCreatePrefix", () => {
  it("appends a dot to the parent's own rdid — the type token is already in it", () => {
    expect(ecoCreatePrefix("ecosystem.fishlamp")).toBe("ecosystem.fishlamp.");
  });

  it("nests as deep as the parent chain goes", () => {
    expect(ecoCreatePrefix("ecosystem.acme.mike")).toBe("ecosystem.acme.mike.");
  });

  it("falls back to the bare type prefix for a root create (no parent)", () => {
    expect(ecoCreatePrefix(null)).toBe("ecosystem.");
  });

  it("is EMPTY while the parent is unresolved — a root address is a different, wrong answer", () => {
    expect(ecoCreatePrefix(undefined)).toBe("");
  });
});

describe("ecoCreateRdid", () => {
  it("derives the owner-scoped address the server will mint", () => {
    expect(ecoCreateRdid("ecosystem.fishlamp", "adh")).toBe("ecosystem.fishlamp.adh");
  });

  it("derives a root address when there is no parent", () => {
    expect(ecoCreateRdid(null, "adh")).toBe("ecosystem.adh");
  });
});

describe("ecoCreateSlugValid", () => {
  it("accepts one lowercase segment with interior hyphens", () => {
    expect(ecoCreateSlugValid("adh")).toBe(true);
    expect(ecoCreateSlugValid("my-product-2")).toBe(true);
  });

  it("rejects a DOTTED slug — the slug is one segment, never a path", () => {
    expect(ecoCreateSlugValid("fishlamp.adh")).toBe(false);
  });

  it("rejects uppercase and a trailing hyphen", () => {
    expect(ecoCreateSlugValid("ADH")).toBe(false);
    expect(ecoCreateSlugValid("adh-")).toBe(false);
  });

  it("rejects a slug past the slug column's width", () => {
    expect(ecoCreateSlugValid("a".repeat(ECOSYSTEM_SLUG_MAX_LENGTH))).toBe(true);
    expect(ecoCreateSlugValid("a".repeat(ECOSYSTEM_SLUG_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("ecoCreateValidate", () => {
  const ready = { ...ecoCreateBlank(), name: "ADH", slug: "adh", rdidStatus: "available" as const };

  it("passes a filled, probed-available draft", () => {
    expect(ecoCreateValidate(ready, "ecosystem.fishlamp")).toBeNull();
  });

  it("refuses to submit while the parent is unresolved", () => {
    expect(ecoCreateValidate(ready, undefined)).toMatch(/prefix/i);
  });

  it("names the too-long slug rather than the grammar", () => {
    const long = { ...ready, slug: "a".repeat(ECOSYSTEM_SLUG_MAX_LENGTH + 1) };
    expect(ecoCreateValidate(long, "ecosystem.fishlamp")).toMatch(
      new RegExp(`${ECOSYSTEM_SLUG_MAX_LENGTH} characters`),
    );
  });

  it("reports an unavailable identifier as the FULL derived address", () => {
    const taken = { ...ready, rdidStatus: "unavailable" as const };
    expect(ecoCreateValidate(taken, "ecosystem.fishlamp")).toContain("ecosystem.fishlamp.adh");
  });
});

describe("ecoCreateToInput", () => {
  it("sends the parent-scoped identifier, trimmed", () => {
    const draft = { ...ecoCreateBlank(), name: " ADH ", slug: " adh ", description: " d " };
    expect(ecoCreateToInput(draft, "ecosystem.fishlamp")).toEqual({
      identifier: "ecosystem.fishlamp.adh",
      name: "ADH",
      description: "d",
      region: "",
      domain: "",
    });
  });
});
