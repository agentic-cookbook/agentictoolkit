// Every test in packages/data/src lives under a `__tests__/` sibling — no exceptions.
import { describe, expect, it } from "vitest";
import {
  CHAT_STATUS_DEFAULT,
  chatStatusBlank,
  parseChatStatus,
  resolveChatStatus,
  type ChatStatusConfig,
} from "../chat-status";

const CONFIG: ChatStatusConfig = {
  words: [
    { tags: ["think"], present: "pondering", past: "pondered" },
    { tags: [], present: "working", past: "worked" },
  ],
  icons: [
    { tags: ["think"], frames: ["·", "✳"] },
    { tags: [], frames: ["o", "O"] },
  ],
  tint: { color: "#a78bfa", applies: "both" },
};

describe("parseChatStatus", () => {
  it("returns the default for null, garbage and arrays", () => {
    for (const junk of [null, undefined, 42, "nope", [], { words: 7 }]) {
      expect(parseChatStatus(junk)).toEqual(CHAT_STATUS_DEFAULT);
    }
  });

  it("drops half-written pairs but keeps the rest", () => {
    const parsed = parseChatStatus({
      words: [
        { tags: [], present: "working", past: "worked" },
        { tags: [], present: "half" },
        "not an object",
      ],
      icons: [{ tags: [], frames: ["o"] }],
    });
    expect(parsed.words).toEqual([{ tags: [], present: "working", past: "worked" }]);
  });

  it("keeps unknown tags rather than rejecting the row", () => {
    const parsed = parseChatStatus({
      words: [{ tags: ["telepathy"], present: "beaming", past: "beamed" }],
      icons: [{ tags: [], frames: ["o"] }],
    });
    expect(parsed.words[0]!.tags).toEqual(["telepathy"]);
  });

  it("drops a tint with no colour and defaults an unreadable `applies` to both", () => {
    expect(parseChatStatus({ tint: { applies: "words" } }).tint).toBeUndefined();
    expect(parseChatStatus({ tint: { color: "#fff", applies: "sideways" } }).tint)
      .toEqual({ color: "#fff", applies: "both" });
  });
});

describe("resolveChatStatus", () => {
  it("prefers rows tagged with the kind", () => {
    const r = resolveChatStatus(CONFIG, "think");
    expect(r.words).toEqual([{ tags: ["think"], present: "pondering", past: "pondered" }]);
    expect(r.frames).toEqual(["·", "✳"]);
    expect(r.tint).toEqual({ color: "#a78bfa", applies: "both" });
  });

  it("falls back to untagged rows for a kind nobody configured", () => {
    const r = resolveChatStatus(CONFIG, "research");
    expect(r.words).toEqual([{ tags: [], present: "working", past: "worked" }]);
    expect(r.frames).toEqual(["o", "O"]);
  });

  it("falls back to the built-in default when a kind has no tagged and no untagged rows", () => {
    const narrow: ChatStatusConfig = {
      words: [{ tags: ["think"], present: "pondering", past: "pondered" }],
      icons: [{ tags: ["think"], frames: ["·"] }],
    };
    const r = resolveChatStatus(narrow, "respond");
    expect(r.words).toEqual(CHAT_STATUS_DEFAULT.words.filter((w) => w.tags.length === 0));
    expect(r.words.length).toBeGreaterThan(0);
    expect(r.frames.length).toBeGreaterThan(0);
  });

  it("resolves words and glyphs independently", () => {
    // A special word for thinking, but no special glyph — the glyph falls through alone.
    const lopsided: ChatStatusConfig = {
      words: [
        { tags: ["think"], present: "pondering", past: "pondered" },
        { tags: [], present: "working", past: "worked" },
      ],
      icons: [{ tags: [], frames: ["o", "O"] }],
    };
    const r = resolveChatStatus(lopsided, "think");
    expect(r.words[0]!.present).toBe("pondering");
    expect(r.frames).toEqual(["o", "O"]);
  });

  it("never throws on garbage", () => {
    expect(() => resolveChatStatus("not a config", "think")).not.toThrow();
    expect(resolveChatStatus(null, "think").words.length).toBeGreaterThan(0);
  });
});

describe("chatStatusBlank", () => {
  it("hands out a fresh copy so one draft cannot mutate the next", () => {
    const a = chatStatusBlank();
    const b = chatStatusBlank();
    expect(a).toEqual(CHAT_STATUS_DEFAULT);
    expect(a.words).not.toBe(b.words);
    expect(a.words[0]).not.toBe(b.words[0]);
  });
});
