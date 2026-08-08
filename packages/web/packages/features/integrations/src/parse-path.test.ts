import { describe, it, expect } from "vitest";
import { integrationsSegments, parseIntegrationsPath } from "./parse-path";

describe("parseIntegrationsPath", () => {
  it("selects nothing with no path segments", () => {
    expect(parseIntegrationsPath(undefined)).toEqual({});
    expect(parseIntegrationsPath([])).toEqual({});
  });

  it("reads the first segment as the destination", () => {
    expect(parseIntegrationsPath(["workspace"])).toEqual({ destinationId: "workspace" });
    expect(parseIntegrationsPath(["eco-1"])).toEqual({ destinationId: "eco-1" });
  });

  it("reads the second segment as the open instance", () => {
    expect(parseIntegrationsPath(["eco-1", "integration.postmark.main"])).toEqual({
      destinationId: "eco-1",
      configId: "integration.postmark.main",
    });
  });

  it("ignores anything past the instance id (the grammar ends there)", () => {
    expect(parseIntegrationsPath(["eco-1", "cfg-1", "extra"])).toEqual({
      destinationId: "eco-1",
      configId: "cfg-1",
    });
  });

  it("drops empty segments rather than reading them as a destination", () => {
    // A doubled or trailing slash must land on the same selection as the tidy URL — otherwise
    // `//cfg-1` would read the EMPTY string as the destination and the real id as the instance.
    expect(parseIntegrationsPath(["", "eco-1", ""])).toEqual({ destinationId: "eco-1" });
    expect(parseIntegrationsPath(["", "eco-1", "cfg-1"])).toEqual({
      destinationId: "eco-1",
      configId: "cfg-1",
    });
  });
});

describe("integrationsSegments", () => {
  it("round-trips every shape the parser accepts", () => {
    for (const selection of [
      {},
      { destinationId: "workspace" },
      { destinationId: "eco-1", configId: "cfg-1" },
    ]) {
      const segments = integrationsSegments(selection.destinationId, selection.configId);
      expect(parseIntegrationsPath(segments)).toEqual(selection);
    }
  });

  it("yields the destination alone when the instance is closed", () => {
    expect(integrationsSegments("eco-1", null)).toEqual(["eco-1"]);
    expect(integrationsSegments("eco-1", undefined)).toEqual(["eco-1"]);
  });

  it("drops the instance with its destination", () => {
    // Not merely tidiness: an instance is only addressable THROUGH its destination, so a config
    // id kept after the destination cleared would be read back as a destination id.
    expect(integrationsSegments(null, "cfg-1")).toEqual([]);
    expect(integrationsSegments(undefined, undefined)).toEqual([]);
  });
});
