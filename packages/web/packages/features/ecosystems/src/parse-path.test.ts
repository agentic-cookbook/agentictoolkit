import { describe, it, expect } from "vitest";
import { parseEcosystemsPath } from "./parse-path";

describe("parseEcosystemsPath", () => {
  it("treats undefined / empty segments as a bare path (no selection)", () => {
    expect(parseEcosystemsPath(undefined)).toEqual({});
    expect(parseEcosystemsPath([])).toEqual({});
  });

  it("treats the legacy 'all' sentinel the same as a bare path", () => {
    expect(parseEcosystemsPath(["all"])).toEqual({});
  });

  it("maps a lone id to activeEcoId", () => {
    expect(parseEcosystemsPath(["eco1"])).toEqual({
      activeEcoId: "eco1",
      activeTopic: undefined,
      activeLeafId: undefined,
      activeMemberEntityId: undefined,
    });
  });

  it("maps [id, topic] to activeEcoId + activeTopic", () => {
    expect(parseEcosystemsPath(["eco1", "storage"])).toEqual({
      activeEcoId: "eco1",
      activeTopic: "storage",
      activeLeafId: undefined,
      activeMemberEntityId: undefined,
    });
  });

  it("maps [id, topic, leaf] to all three selection props", () => {
    expect(parseEcosystemsPath(["eco1", "storage", "buckets"])).toEqual({
      activeEcoId: "eco1",
      activeTopic: "storage",
      activeLeafId: "buckets",
      activeMemberEntityId: undefined,
    });
  });

  it("maps [id, topic, leaf, memberEntity] to the full 5-segment selection", () => {
    expect(parseEcosystemsPath(["eco1", "storage", "buckets", "bucket9"])).toEqual({
      activeEcoId: "eco1",
      activeTopic: "storage",
      activeLeafId: "buckets",
      activeMemberEntityId: "bucket9",
    });
  });
});
