import { describe, it, expect } from "vitest";
import { parseDashboardsPath } from "./parse-path";

describe("parseDashboardsPath", () => {
  it("treats undefined / empty segments as a bare path (nothing selected)", () => {
    expect(parseDashboardsPath(undefined)).toEqual({ section: undefined, rowId: undefined });
    expect(parseDashboardsPath([])).toEqual({ section: undefined, rowId: undefined });
  });

  it("maps a lone segment to the open section", () => {
    expect(parseDashboardsPath(["groups"])).toEqual({ section: "groups", rowId: undefined });
    expect(parseDashboardsPath(["sites"])).toEqual({ section: "sites", rowId: undefined });
  });

  it("maps [section, rowId] to the section + the selected row", () => {
    expect(parseDashboardsPath(["groups", "g1"])).toEqual({ section: "groups", rowId: "g1" });
    expect(parseDashboardsPath(["sites", "s1"])).toEqual({ section: "sites", rowId: "s1" });
  });
});
