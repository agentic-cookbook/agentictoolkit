import { describe, it, expect } from "vitest";
import { parseKnowledgeBasesPath } from "./parse-path";

describe("parseKnowledgeBasesPath", () => {
  it("ignores the catch-all segments — table selection is local, not URL-driven", () => {
    expect(parseKnowledgeBasesPath(undefined)).toEqual({});
    expect(parseKnowledgeBasesPath([])).toEqual({});
    expect(parseKnowledgeBasesPath(["blocks"])).toEqual({});
    expect(parseKnowledgeBasesPath(["blocks", "extra"])).toEqual({});
  });
});
