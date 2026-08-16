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
  // spec's rule is that this blob is narrowed exactly once, through `parseChatStatus`, and this
  // asserts the facet actually does that rather than trusting the type annotation.
  it("renders instead of throwing when the stored value has a malformed shape", () => {
    const malformed = {
      words: "nope",
      icons: [{ tags: [], frames: ["o"] }],
      tint: "not an object",
    } as unknown as ChatStatusConfig;
    const onChange = vi.fn();

    expect(() => render(<ChatStatusFacet value={malformed} onChange={onChange} />)).not.toThrow();
    // `words: "nope"` is not an array, so `parseChatStatus` drops it and falls back to the
    // blank word list rather than propagating the malformed value.
    expect(screen.getAllByLabelText("Present tense")[0]).toHaveValue(
      chatStatusBlank().words[0]!.present,
    );
  });

  it("renders instead of throwing when icons is not an array", () => {
    const malformed = { words: [{ tags: [], present: "x", past: "xed" }], icons: {} } as never;
    const onChange = vi.fn();

    expect(() => render(<ChatStatusFacet value={malformed} onChange={onChange} />)).not.toThrow();
  });
});
