import { describe, expect, it } from "vitest";
import { toEcosystem } from "../ecosystems";

describe("toEcosystem", () => {
  it("maps the rdid id to both id+identifier and primaryDomain→domain", () => {
    const e = toEcosystem({
      id: "com.acme",
      name: "Acme",
      description: "desc",
      region: "us-east",
      primaryDomain: "acme.com",
      createdAt: "c",
      updatedAt: "u",
      isDefault: false,
      slug: "acme",
    });
    expect(e.id).toBe("com.acme");
    expect(e.identifier).toBe("com.acme");
    expect(e.domain).toBe("acme.com");
  });
  it("defaults nullable text columns to empty strings", () => {
    const e = toEcosystem({
      id: "x",
      name: "X",
      description: null,
      region: null,
      primaryDomain: null,
      createdAt: "c",
      updatedAt: "u",
      isDefault: false,
      slug: "x",
    });
    expect(e.description).toBe("");
    expect(e.region).toBe("");
    expect(e.domain).toBe("");
  });
});
