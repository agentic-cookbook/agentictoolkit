import { describe, it, expect } from "vitest";
import { parseProjectsPath } from "./parse-path";

describe("parseProjectsPath", () => {
  it("treats undefined / empty segments as a bare path (no flags)", () => {
    expect(parseProjectsPath(undefined)).toEqual({});
    expect(parseProjectsPath([])).toEqual({});
  });

  it("maps the explicit 'all' sentinel to { all: true }", () => {
    expect(parseProjectsPath(["all"])).toEqual({ all: true });
  });

  it("maps a lone id to activeProjectId", () => {
    expect(parseProjectsPath(["p1"])).toEqual({
      activeProjectId: "p1",
      activeTopic: undefined,
      activeLeafId: undefined,
    });
  });

  it("maps [id, topic] to activeProjectId + activeTopic", () => {
    expect(parseProjectsPath(["p1", "overview"])).toEqual({
      activeProjectId: "p1",
      activeTopic: "overview",
      activeLeafId: undefined,
    });
  });

  it("maps [id, topic, leaf] to all three selection props", () => {
    expect(parseProjectsPath(["p1", "work-items", "wi9"])).toEqual({
      activeProjectId: "p1",
      activeTopic: "work-items",
      activeLeafId: "wi9",
    });
  });
});
