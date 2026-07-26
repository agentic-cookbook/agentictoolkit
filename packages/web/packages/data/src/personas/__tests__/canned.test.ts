// Every test in packages/data/src lives under a `__tests__/` sibling — no exceptions.
import { describe, expect, it } from "vitest";
import { canDemoChat } from "../canned";
import type { CannedChatConfig } from "../personas";

const good: CannedChatConfig = {
  enabled: true,
  pacing: { thinkMinMs: 2000, thinkJitterMs: 3000, tokenMinMs: 45, tokenJitterMs: 55, reveal: "word" },
  script: {
    intro: ["hi"],
    seeded: [{ match: ["help"], reply: "no commands." }],
    fallbacks: ["noted."],
    onExhausted: "reshuffle",
  },
};
const script = (over: Partial<CannedChatConfig["script"]>): CannedChatConfig => ({
  ...good,
  script: { intro: [], seeded: [], fallbacks: [], onExhausted: "reshuffle", ...over },
});

/**
 * These cases are the frontend half of a pair: each one is also asserted against the
 * authoritative backend predicate in backend/src/adh/test/canned-config.test.ts
 * ("canDemoChat — the one predicate behind demoEnabled and the claim"). If the two ever
 * disagree, the UI is back to promising a demo the server will not serve.
 */
describe("canDemoChat mirrors the backend's demo predicate", () => {
  it("is true only for a config that is switched on AND has a line to say", () => {
    expect(canDemoChat(good)).toBe(true);
    expect(canDemoChat(script({ intro: ["only an opening line"] }))).toBe(true);
    expect(canDemoChat(script({ seeded: [{ match: ["pricing"], reply: "free." }] }))).toBe(true);
    expect(canDemoChat(script({ fallbacks: ["noted."] }))).toBe(true);
  });

  it("is false for the states a raw `enabled === true` read called true", () => {
    // Ticked and saved before anything was written.
    expect(canDemoChat(script({}))).toBe(false);
    // Rows added by the editor's Add button but never typed into.
    expect(canDemoChat(script({ intro: ["  "], fallbacks: [""] }))).toBe(false);
    // A seeded row that can never fire: no keyword, or nothing to say.
    expect(canDemoChat(script({ seeded: [{ match: [""], reply: "x" }] }))).toBe(false);
    expect(canDemoChat(script({ seeded: [{ match: ["hi"], reply: "  " }] }))).toBe(false);
  });

  it("is false for a parked script and for no config at all", () => {
    expect(canDemoChat({ ...good, enabled: false })).toBe(false);
    expect(canDemoChat(null)).toBe(false);
    expect(canDemoChat(undefined)).toBe(false);
  });

  it("is false for malformed jsonb — a CRUD or import write the server would reject", () => {
    expect(canDemoChat({ enabled: true })).toBe(false);
    expect(canDemoChat({ enabled: "yes", script: good.script })).toBe(false);
    expect(canDemoChat({ enabled: true, script: { intro: "oops" } })).toBe(false);
    expect(canDemoChat({ enabled: true, script: [] })).toBe(false);
    expect(canDemoChat({ enabled: true, script: { ...good.script, onExhausted: "explode" } })).toBe(false);
    expect(canDemoChat({ enabled: true, script: { ...good.script, seeded: [{ match: "help", reply: "x" }] } })).toBe(false);
    expect(canDemoChat({ ...good, pacing: { ...good.pacing, thinkMinMs: -1 } })).toBe(false);
    expect(canDemoChat({ ...good, pacing: { ...good.pacing, reveal: "sentence" } })).toBe(false);
    expect(canDemoChat("not even an object")).toBe(false);
  });

  it("accepts an absent pacing block — the server fills in its defaults", () => {
    expect(canDemoChat({ enabled: true, script: good.script })).toBe(true);
    // Over-ceiling pacing is CLAMPED server-side, not rejected: still a demo.
    expect(canDemoChat({ ...good, pacing: { ...good.pacing, thinkMinMs: 35_000 } })).toBe(true);
  });
});
