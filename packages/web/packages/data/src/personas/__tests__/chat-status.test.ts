// Every test in packages/data/src lives under a `__tests__/` sibling — no exceptions.
import { describe, expect, it } from "vitest";
import {
  CHAT_STATUS_DEFAULT,
  chatStatusBlank,
  parseChatStatus,
  parseChatStatusDraft,
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
  it("returns the default for non-object input", () => {
    for (const junk of [null, undefined, 42, "nope", []]) {
      expect(parseChatStatus(junk)).toEqual(CHAT_STATUS_DEFAULT);
    }
  });

  it("drops a malformed words/icons field to an empty list rather than substituting the default", () => {
    // `{ words: 7 }` IS an object, unlike the non-object junk above — it does not hit the
    // `chatStatusBlank()` early return. `words: 7` fails `Array.isArray`, so `parseWords`
    // drops it to `[]`, and Fix 2 means that stays `[]` instead of being swapped back for
    // `CHAT_STATUS_DEFAULT`'s five rows.
    expect(parseChatStatus({ words: 7 })).toEqual({ words: [], icons: [] });
  });

  it("preserves an empty list rather than substituting the default — an author can delete every row", () => {
    // Before this fix, `words.length > 0 ? words : blank.words` meant deleting the last row
    // of a persona's custom words jumped the list straight back to the five built-in rows,
    // making "this persona has no custom words" inexpressible.
    const parsed = parseChatStatus({ words: [], icons: [] });
    expect(parsed.words).toEqual([]);
    expect(parsed.icons).toEqual([]);

    // `resolveChatStatus` still totalizes through its own fallback chain, independent of the
    // parser no longer substituting defaults.
    const r = resolveChatStatus({ words: [], icons: [] }, "think");
    expect(r.words.length).toBeGreaterThan(0);
    expect(r.frames.length).toBeGreaterThan(0);
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
  it("unions rows tagged with the kind with untagged rows that fit anything", () => {
    // Words are a UNION, not an exclusive chain (unlike icons, see the "resolves words and
    // glyphs independently" test's asymmetry below): the editor's hint text says an untagged
    // word "fits anything", so a tagged match must not suppress the untagged rows too.
    const r = resolveChatStatus(CONFIG, "think");
    expect(r.words).toEqual([
      { tags: ["think"], present: "pondering", past: "pondered" },
      { tags: [], present: "working", past: "worked" },
    ]);
    expect(r.frames).toEqual(["·", "✳"]);
    expect(r.tint).toEqual({ color: "#a78bfa", applies: "both" });
  });

  it("unions a tagged pair with the untagged pairs for the shipped default", () => {
    // Before this fix, `CHAT_STATUS_DEFAULT` has exactly one pair per tag, so every kind the
    // engine emits (`think`/`respond`/`retry`) resolved to a ONE-element list and the shuffle
    // bag redrew the same word forever — the branch's headline behaviour was inert.
    const r = resolveChatStatus(CHAT_STATUS_DEFAULT, "think");
    expect(r.words).toContainEqual({ tags: ["think"], present: "thinking", past: "thought" });
    expect(r.words).toContainEqual({ tags: [], present: "working", past: "worked" });
    expect(r.words).toContainEqual({ tags: [], present: "investigating", past: "investigated" });
    expect(r.words.length).toBeGreaterThan(1);
  });

  it("falls back to untagged rows for a kind nobody configured", () => {
    const r = resolveChatStatus(CONFIG, "research");
    expect(r.words).toEqual([{ tags: [], present: "working", past: "worked" }]);
    expect(r.frames).toEqual(["o", "O"]);
  });

  it("falls back to the built-in default's eligible rows when a kind has no tagged and no untagged rows", () => {
    const narrow: ChatStatusConfig = {
      words: [{ tags: ["think"], present: "pondering", past: "pondered" }],
      icons: [{ tags: ["think"], frames: ["·"] }],
    };
    const r = resolveChatStatus(narrow, "respond");
    // The fallback rung is `eligible(fallback.words)`, the SAME union rule as the primary
    // config — not just the built-in's untagged rows — so it includes CHAT_STATUS_DEFAULT's
    // own `respond`-tagged pair alongside its untagged ones.
    expect(r.words).toEqual(
      CHAT_STATUS_DEFAULT.words.filter((w) => w.tags.includes("respond") || w.tags.length === 0),
    );
    expect(r.words).toContainEqual({ tags: ["respond"], present: "responding", past: "responded" });
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

describe("parseChatStatusDraft", () => {
  it("returns the default for non-object input, same as parseChatStatus", () => {
    for (const junk of [null, undefined, 42, "nope", []]) {
      expect(parseChatStatusDraft(junk)).toEqual(CHAT_STATUS_DEFAULT);
    }
  });

  it("keeps a half-written pair, unlike parseChatStatus", () => {
    const parsed = parseChatStatusDraft({
      words: [{ tags: [], present: "half", past: "" }],
      icons: [],
    });
    expect(parsed.words).toEqual([{ tags: [], present: "half", past: "" }]);
  });

  it("keeps a glyph set with zero frames, unlike parseChatStatus", () => {
    const parsed = parseChatStatusDraft({ words: [], icons: [{ tags: [], frames: [] }] });
    expect(parsed.icons).toEqual([{ tags: [], frames: [] }]);
  });

  it("does not trim text or drop empty tags/frames", () => {
    const parsed = parseChatStatusDraft({
      words: [{ tags: [""], present: "trying again ", past: "" }],
      icons: [{ tags: [], frames: ["o", ""] }],
    });
    expect(parsed.words[0]!.present).toBe("trying again ");
    expect(parsed.words[0]!.tags).toEqual([""]);
    expect(parsed.icons[0]!.frames).toEqual(["o", ""]);
  });
});
