import { describe, expect, it } from "vitest";
import { toGroup, toSite, toEndpoint } from "../monitored-sites";

describe("monitored-sites mappers", () => {
  it("toSite renames siteGroupId→groupId", () => {
    const s = toSite({
      id: "s1",
      slug: "site",
      name: "Site",
      siteGroupId: "g1",
      createdAt: "c",
      updatedAt: "u",
    });
    expect(s.groupId).toBe("g1");
  });
  it("toGroup carries the retention window through", () => {
    const g = toGroup({
      id: "g1",
      slug: "grp",
      name: "Grp",
      retentionDays: 30,
      createdAt: "c",
      updatedAt: "u",
    });
    expect(g.retentionDays).toBe(30);
  });
  it("toEndpoint preserves the check fields", () => {
    const e = toEndpoint({
      id: "e1",
      siteId: "s1",
      url: "https://x",
      kind: "http",
      expectedStatus: 200,
      checkIntervalSeconds: 60,
      isActive: true,
      createdAt: "c",
      updatedAt: "u",
    });
    expect(e.expectedStatus).toBe(200);
    expect(e.isActive).toBe(true);
  });
});
