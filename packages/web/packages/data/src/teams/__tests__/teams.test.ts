import { describe, expect, it } from "vitest";
import { toTeam, validateTeamIdentifier } from "../teams";

describe("toTeam", () => {
  it("renames name→displayName and slug→identifier", () => {
    const t = toTeam({
      id: "1",
      name: "Platform",
      slug: "com.acme.platform",
      createdAt: "c",
      updatedAt: "u",
    });
    expect(t.displayName).toBe("Platform");
    expect(t.identifier).toBe("com.acme.platform");
  });
});

describe("validateTeamIdentifier", () => {
  it("accepts reverse-domain identifiers", () => {
    expect(validateTeamIdentifier("com.acme.platform")).toBeNull();
  });

  it("rejects an empty identifier", () => {
    expect(validateTeamIdentifier("")).toMatch(/required/i);
  });

  it("rejects a single-label identifier", () => {
    expect(validateTeamIdentifier("platform")).toMatch(/reverse-domain/i);
  });
});
