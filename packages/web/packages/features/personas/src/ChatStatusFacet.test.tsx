import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { chatStatusBlank, type ChatStatusConfig } from "@agentic-toolkit/data/personas";
// `./`, not `../` — this test sits BESIDE its source. Every test in this package is
// colocated (see the note at the top of `RowsField.test.tsx`); only `packages/data` uses a
// `__tests__/` subdirectory.
import { ChatStatusFacet } from "./ChatStatusFacet";

// Hoisted `vi.mock`, NOT `vi.doMock` inside a test body. `vi.mock` is lifted above the imports,
// so the stub is in place before `ChatStatusFacet` is ever evaluated. A `vi.doMock` called from
// inside a test arrives too late — the facet is already holding the real binding — so the
// regression guard below would record nothing and pass no matter what the component does.
// A hoisted factory can only reach variables created by `vi.hoisted`, which is why
// `seenLabels` is declared that way rather than as a plain `const`.
//
// Mock the specifier THE FACET IMPORTS (`@agentic-toolkit/persona/chat`). Do not reach past it
// to `@agenticdevelopertoolkit/chat`: `persona/chat` re-exports that module and the built `dist`
// may not preserve a live binding through the re-export, so the stub might never reach the
// facet — and `features/personas` must not name `@agenticdevelopertoolkit/*` at all (Step 1).
//
// The stub applies to the whole file. That is fine: no other test here asserts on anything
// `TypingIndicator` renders, they all drive buttons and selects.
const seenLabels = vi.hoisted(() => [] as unknown[]);
vi.mock("@agentic-toolkit/persona/chat", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  TypingIndicator: (props: { labels: unknown }) => {
    seenLabels.push(props.labels);
    return null;
  },
}));

const CFG: ChatStatusConfig = {
  words: [{ tags: ["think"], present: "fleeping", past: "fleeped" }],
  icons: [{ tags: [], frames: ["o", "O"] }],
};

describe("ChatStatusFacet", () => {
  // REGRESSION GUARD — do not delete, and do not weaken it to a single render.
  //
  // `chatStatusBlank()` deep-copies, so `value ?? chatStatusBlank()` written inline yields a
  // new object on every render when `value` is null. That defeats the `preview` memo, which
  // hands `TypingIndicator` a new `labels` array every render; the indicator keys its
  // draw-without-replacement bag on that array's identity, so the bag resets and the word
  // starts jumping at random. `usePreviewPulse` re-renders every 4 seconds, so this fires on
  // its own with no user input — and only for a persona with no config yet, which is every
  // newly created one.
  //
  // The assertion is on the IDENTITY of the labels array across a re-render, because that is
  // the actual invariant. Asserting on rendered text would pass by luck whenever the bag
  // happened to redraw the same word.
  it("keeps the preview's word list stable across re-renders when value is null", () => {
    // Cleared here, not left to test order: every render in this file pushes to `seenLabels`.
    seenLabels.length = 0;

    const { rerender } = render(<ChatStatusFacet value={null} onChange={vi.fn()} />);
    rerender(<ChatStatusFacet value={null} onChange={vi.fn()} />);

    expect(seenLabels.length).toBeGreaterThan(1);
    expect(seenLabels[seenLabels.length - 1]).toBe(seenLabels[0]);
  });

  it("adds a word pair without disturbing the existing rows", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add word pair" }));
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    expect(next.words).toHaveLength(2);
    expect(next.words[0]).toEqual(CFG.words[0]);
    expect(next.words[1]).toEqual({ tags: [], present: "", past: "" });
  });

  // FIX 3 regression guards — the previous three: a plain click-and-check-the-onChange-call
  // test (above) is not enough, because `patch` hands the freshly appended row straight to
  // `onChange` without re-parsing it. The bug only showed up on the ROUND TRIP every real
  // caller performs: the parent stores what `onChange` gave it and feeds it back in as the
  // next `value`, and `cfg` (`ChatStatusFacet.tsx`, the `useMemo` a few lines above the JSX)
  // re-parses that value on every render. Before this fix that memo called `parseChatStatus`
  // (`@agentic-toolkit/data/personas`'s STORAGE validator), which drops a word missing a
  // half (`chat-status.ts`'s `parseWords`, "A pair with one half is not a pair"), drops a
  // glyph set with no frames (`parseIcons`, "if (frames.length === 0) continue"), and trims
  // every string through `textOf`'s `v.trim()`. Each of the three round trips below re-lands
  // on exactly one of those rules and asserts the row/character it drops.
  it("keeps an added word pair across a controlled round trip", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add word pair" }));
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    rerender(<ChatStatusFacet value={next} onChange={onChange} />);
    expect(screen.getAllByLabelText("Present tense")).toHaveLength(2);
  });

  it("keeps an added glyph set across a controlled round trip", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add glyph set" }));
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    rerender(<ChatStatusFacet value={next} onChange={onChange} />);
    expect(screen.getAllByLabelText("Glyphs")).toHaveLength(2);
  });

  it("keeps a typed trailing space in Present tense across a controlled round trip", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.change(screen.getAllByLabelText("Present tense")[0]!, {
      target: { value: "trying again " },
    });
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    rerender(<ChatStatusFacet value={next} onChange={onChange} />);
    expect(screen.getAllByLabelText("Present tense")[0]).toHaveValue("trying again ");
  });

  it("removes the row the button names", () => {
    const two: ChatStatusConfig = {
      ...CFG,
      words: [
        { tags: [], present: "one", past: "oned" },
        { tags: [], present: "two", past: "twoed" },
      ],
    };
    const onChange = vi.fn();
    render(<ChatStatusFacet value={two} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove row 1 of Words" }));
    expect((onChange.mock.calls[0]![0] as ChatStatusConfig).words).toEqual([two.words[1]]);
  });

  it("adds a preset pair on top of what is already there", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Add a preset word pair"), {
      target: { value: "pondering" },
    });
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    expect(next.words).toHaveLength(2);
    expect(next.words[0]!.present).toBe("fleeping");
    expect(next.words[1]!.present).toBe("pondering");
  });

  it("adds a preset glyph set", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Add a preset glyph set"), {
      target: { value: "Sparkle" },
    });
    const next = onChange.mock.calls[0]![0] as ChatStatusConfig;
    expect(next.icons).toHaveLength(2);
    expect(next.icons[1]!.frames[0]).toBe("·");
  });

  it("edits glyphs as one string of characters", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Glyphs"), { target: { value: "◐◓◑" } });
    expect((onChange.mock.calls[0]![0] as ChatStatusConfig).icons[0]!.frames).toEqual(["◐", "◓", "◑"]);
  });

  // FIX 5 regression guard: `Array.from(text)` (the pre-fix `framesFromText`) splits by UTF-16
  // CODE POINT, a smaller unit than a grapheme. `❤️` is heart + variation selector (2 code
  // points), `👨‍💻` is man + ZWJ + laptop (3), `🇺🇸` is two regional-indicator letters (2) — so
  // the old code split this three-emoji string into 7 frames, not 3, and the shipped animation
  // stuttered through frames that render as nothing or as half a combined glyph while the field
  // itself looked correct (`frames.join("")` re-glues them for display).
  it("keeps each combined emoji as one frame, not one per code point", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Glyphs"), { target: { value: "❤️👨‍💻🇺🇸" } });
    expect((onChange.mock.calls[0]![0] as ChatStatusConfig).icons[0]!.frames).toEqual([
      "❤️",
      "👨‍💻",
      "🇺🇸",
    ]);
  });

  it("turns the tint on and off", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChatStatusFacet value={CFG} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Tint the status line"));
    const tinted = onChange.mock.calls[0]![0] as ChatStatusConfig;
    expect(tinted.tint).toEqual({ color: "#a78bfa", applies: "both" });

    onChange.mockClear();
    rerender(<ChatStatusFacet value={tinted} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Tint the status line"));
    expect((onChange.mock.calls[0]![0] as ChatStatusConfig).tint).toBeUndefined();
  });

  // FIX 4 regression guard: pre-fix, the ONLY colour control was `<Input type="color">`, and
  // jsdom implements the same value-sanitization algorithm real browsers do
  // (`sanitizeValueByType` in jsdom's `form-controls.js`): a value that is not a 6-digit
  // `#rrggbb` hex string — `#fff` included, the branch's own shipped fixture at
  // `chat-status.test.ts:52` — is coerced to `#000000` before it ever reaches the DOM. So a
  // stored `#fff` displayed, and would have been written back, as black.
  it("keeps a non-6-digit-hex tint colour in the text field rather than mangling it to black", () => {
    const withTint: ChatStatusConfig = { ...CFG, tint: { color: "#fff", applies: "both" } };
    render(<ChatStatusFacet value={withTint} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Tint colour")).toHaveValue("#fff");
  });

  it("falls back to the blank configuration when the persona has none", () => {
    const onChange = vi.fn();
    render(<ChatStatusFacet value={null} onChange={onChange} />);
    expect(screen.getAllByLabelText("Present tense")[0]).toHaveValue(
      chatStatusBlank().words[0]!.present,
    );
  });

  // Finding 1 regression guard: `value` is the untrusted stored `chat_status` jsonb blob, and
  // the CRUD write side does not validate its shape (drizzle-zod maps any `json` column to its
  // permissive schema, so `{ words: "nope" }` or a garbage `tint` can genuinely be stored and
  // read back). Before this fix, `ChatStatusFacet` handed such a value straight to `RowsField`,
  // which threw (`"nope".length` passes the empty check, then `.map is not a function`) — the
  // spec's rule is that this blob is narrowed exactly once, through `parseChatStatusDraft`, and
  // this asserts the facet actually does that rather than trusting the type annotation.
  it("renders instead of throwing when the stored value has a malformed shape", () => {
    const malformed = {
      words: "nope",
      icons: [{ tags: [], frames: ["o"] }],
      tint: "not an object",
    } as unknown as ChatStatusConfig;
    const onChange = vi.fn();

    expect(() => render(<ChatStatusFacet value={malformed} onChange={onChange} />)).not.toThrow();
    // `words: "nope"` is not an array — a shape problem, not an in-progress row — so even the
    // editor's lenient `parseChatStatusDraft` drops it to `[]`. Unlike `parseChatStatus`, it
    // does NOT substitute the five built-in rows for the malformed field: an editor that
    // silently swapped in defaults for a field the author never touched could save those
    // defaults over data nobody asked to change. Nothing throws, and no "Present tense" field
    // renders for the list that got dropped.
    expect(screen.queryAllByLabelText("Present tense")).toHaveLength(0);
  });

  it("renders instead of throwing when icons is not an array", () => {
    const malformed = { words: [{ tags: [], present: "x", past: "xed" }], icons: {} } as never;
    const onChange = vi.fn();

    expect(() => render(<ChatStatusFacet value={malformed} onChange={onChange} />)).not.toThrow();
  });
});
