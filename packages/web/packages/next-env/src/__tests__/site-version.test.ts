import { describe, expect, it, vi } from "vitest";
import { sanitizeVersion } from "../index.js";

// Ported verbatim from next-config-base.mjs:290. SEMVER_RE is /^\d+\.\d+\.\d+$/ —
// a BARE semver, so a prerelease or build-metadata suffix is deliberately rejected.
describe("sanitizeVersion", () => {
  it.each([
    ["1.2.3", "1.2.3"],
    ["v1.2.3", "1.2.3"],
    ["V1.2.3", "1.2.3"],
    ["  1.2.3  \n", "1.2.3"],
    ["﻿1.2.3", "1.2.3"], // a BOM, which is what an editor-written VERSION carries
    ["1.2.3\nignored second line", "1.2.3"],
  ])("accepts %j as %j", (raw, expected) => {
    expect(sanitizeVersion(raw, "/x/VERSION")).toBe(expected);
  });

  it.each(["", "1.2", "1.2.3-rc.1", "1.2.3+build", "vv1.2.3", "not a version"])(
    "rejects %j, returning \"\" rather than a confident lie",
    (raw) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(sanitizeVersion(raw, "/x/VERSION")).toBe("");
        // The warning names the path AND the raw value — that pairing is what makes
        // a broken VERSION file diagnosable from a build log alone.
        expect(String(warn.mock.calls[0]?.[0])).toContain("/x/VERSION");
        expect(String(warn.mock.calls[0]?.[0])).toContain(JSON.stringify(raw));
      } finally {
        warn.mockRestore();
      }
    },
  );
});
