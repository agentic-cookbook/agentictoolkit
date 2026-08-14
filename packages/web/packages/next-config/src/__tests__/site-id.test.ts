import { describe, expect, it } from "vitest";
import { currentSiteId } from "../site-id.js";

describe("currentSiteId", () => {
  it("derives the id from the working directory's basename", () => {
    expect(currentSiteId("/repo/frontend/src/sites/hub")).toBe("hub");
  });

  it("tolerates a trailing separator", () => {
    expect(currentSiteId("/repo/frontend/src/sites/registries/")).toBe("registries");
  });

  it("throws a directed error when the directory is not a registered site", () => {
    expect(() => currentSiteId("/repo/frontend/src/sites/not-a-site")).toThrowError(
      /not-a-site/,
    );
    expect(() => currentSiteId("/repo/frontend/src/sites/not-a-site")).toThrowError(
      /registry\.ts/,
    );
  });
});
