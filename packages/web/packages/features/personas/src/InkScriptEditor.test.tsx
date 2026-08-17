// .../features/personas/src/InkScriptEditor.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import {
  MAX_PREVIEW_HISTORY_ENTRIES,
  MAX_PREVIEW_TURNS,
  demoPreviewApi,
  type DemoPreviewTurn,
} from "@agentic-toolkit/data/personas";
import { InkScriptEditor } from "./InkScriptEditor";

// The editor holds no ink engine of its own — every answer on the screen came from
// `demoPreviewApi.play`, so that is the only thing stubbed. What these tests pin is the two
// SHAPES of call the one endpoint serves: the lint (source, no message) and a played turn
// (message + the transcript before it), and that the turn's `text: null` is rendered as the
// demo declining rather than as an empty reply.
vi.mock("@agentic-toolkit/data/personas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data/personas")>();
  return { ...actual, demoPreviewApi: { play: vi.fn() } };
});

const play = vi.mocked(demoPreviewApi.play);

const TURN = (over: Partial<DemoPreviewTurn> = {}): DemoPreviewTurn => ({
  text: "Hi — I'm Bob.",
  onScript: true,
  signInLine: false,
  budgetExhausted: false,
  choices: [],
  diagnostics: [],
  tagPlacementHint: "A # match: tag must sit INSIDE the choice's square brackets.",
  ...over,
});

const SOURCE = "Hi — I'm Bob.\n+ [Yes # match: yes, sure]\n    Good.\n    -> DONE\n";

function renderEditor(
  value: { source: string; signInLine: string } | null,
  onChange = vi.fn(),
) {
  render(
    <ToolkitQueryProvider>
      <InkScriptEditor value={value} onChange={onChange} />
    </ToolkitQueryProvider>,
  );
  return onChange;
}

/** The debounce is 600 ms of real time; give the lint room without pinning the number here. */
const settle = { timeout: 3000 };

beforeEach(() => {
  play.mockReset();
  play.mockResolvedValue(TURN());
});
afterEach(cleanup);

describe("InkScriptEditor lint", () => {
  it("compiles the draft with no message — the lint arm of the same endpoint", async () => {
    renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);
    const body = play.mock.calls[0]![0];
    expect(body.source).toBe(SOURCE);
    expect(body.message).toBeUndefined();
    expect(body.history).toBeUndefined();
  });

  it("asks nothing for a blank draft", async () => {
    renderEditor(null);
    await new Promise((r) => setTimeout(r, 900));
    expect(play).not.toHaveBeenCalled();
  });

  it("shows the compiler's diagnostics with their line numbers", async () => {
    play.mockResolvedValue(
      TURN({
        text: null,
        diagnostics: [{ severity: "error", line: 2, message: "unknown divert target 'nowhere'" }],
      }),
    );
    renderEditor({ source: "Hi.\n-> nowhere\n", signInLine: "" });
    expect(await screen.findByText(/unknown divert target/i, undefined, settle)).toBeTruthy();
    expect(screen.getByText(/line 2/i)).toBeTruthy();
  });

  // A script that will not compile is not saveable while demo chat is on (the backend's
  // pre-create/pre-update hooks refuse it), and the author needs to know that HERE rather than
  // from a failed save of a whole persona.
  it("says an error blocks the save while demo chat is on", async () => {
    play.mockResolvedValue(
      TURN({ diagnostics: [{ severity: "error", line: 1, message: "boom" }] }),
    );
    renderEditor({ source: "Hi.", signInLine: "" });
    expect(await screen.findByText(/can't be saved/i, undefined, settle)).toBeTruthy();
  });

  it("keeps quiet about a warning — it compiles, so it saves", async () => {
    play.mockResolvedValue(
      TURN({ diagnostics: [{ severity: "warning", line: 4, message: "knot never used" }] }),
    );
    renderEditor({ source: SOURCE, signInLine: "" });
    expect(await screen.findByText(/knot never used/i, undefined, settle)).toBeTruthy();
    expect(screen.queryByText(/can't be saved/i)).toBeNull();
  });
});

describe("InkScriptEditor conversation", () => {
  it("plays a turn with the transcript so far, and grows it", async () => {
    renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);
    play.mockResolvedValue(TURN({ text: "Good." }));

    fireEvent.change(screen.getByLabelText(/say something to the persona/i), {
      target: { value: "yes please" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Good.", undefined, settle)).toBeTruthy();
    expect(screen.getByText("yes please")).toBeTruthy();
    const first = play.mock.lastCall![0];
    // Nothing was said before this message, so the history is empty — not seeded with the
    // opening the lint produced, which the visitor never sent.
    expect(first.message).toBe("yes please");
    expect(first.history).toEqual([]);

    play.mockResolvedValue(TURN({ text: "Tell me the animal." }));
    fireEvent.change(screen.getByLabelText(/say something to the persona/i), {
      target: { value: "a cat" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText("Tell me the animal.", undefined, settle);
    expect(play.mock.lastCall![0].history).toEqual([
      { role: "user", content: "yes please" },
      { role: "assistant", content: "Good." },
    ]);
  });

  // `text: null` is the one reply the demo does not make: the message went to the persona's real
  // model. Rendering it as a blank line would read as the script saying nothing.
  it("names the escalation instead of showing an empty reply", async () => {
    renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);
    play.mockResolvedValue(TURN({ text: null, onScript: false }));

    fireEvent.click(screen.getByRole("checkbox", { name: /signed-in visitor/i }));
    fireEvent.change(screen.getByLabelText(/say something to the persona/i), {
      target: { value: "what is the capital of france" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/the real model answers here/i, undefined, settle)).toBeTruthy();
    expect(play.mock.lastCall![0].canEscalate).toBe(true);
  });

  it("previews the anonymous visitor by default", async () => {
    renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);
    fireEvent.change(screen.getByLabelText(/say something to the persona/i), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await waitFor(() => expect(play.mock.lastCall![0].message).toBe("hello"), settle);
    expect(play.mock.lastCall![0].canEscalate).toBe(false);
  });

  it("starts the conversation over without touching the script", async () => {
    const onChange = renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);
    fireEvent.change(screen.getByLabelText(/say something to the persona/i), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText("hello", undefined, settle);

    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.queryByText("hello")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("InkScriptEditor transcript ceiling", () => {
  // The route caps `history` at MAX_PREVIEW_HISTORY_ENTRIES and a transcript only ever grows, so
  // an editor that does not know the number posts one over the line and then EVERY later turn
  // fails the same way — a 400 rendered as "try again", which trying again can never clear.
  it("stops at the length the route refuses rather than sending a turn that 400s", async () => {
    renderEditor({ source: SOURCE, signInLine: "" });
    await waitFor(() => expect(play).toHaveBeenCalled(), settle);

    const input = screen.getByLabelText(/say something to the persona/i);
    for (let i = 0; i < MAX_PREVIEW_TURNS; i++) {
      play.mockResolvedValue(TURN({ text: `reply ${i}` }));
      fireEvent.change(input, { target: { value: `message ${i}` } });
      fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
      await screen.findByText(`reply ${i}`, undefined, settle);
    }

    for (const call of play.mock.calls) {
      expect((call[0].history ?? []).length).toBeLessThanOrEqual(MAX_PREVIEW_HISTORY_ENTRIES);
    }
    // Only `full` can disable the box here — the script is non-blank and the panel is not
    // read-only — so this is the ceiling doing it, and the author is told which ceiling.
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(new RegExp(`${MAX_PREVIEW_TURNS} turns`))).toBeTruthy();

    // And starting over is the way on, without touching the script.
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect((screen.getByLabelText(/say something to the persona/i) as HTMLInputElement).disabled).toBe(
      false,
    );
  });
});

describe("InkScriptEditor choices", () => {
  // The whole reason this list exists: a `# match:` tag written outside the brackets attaches to
  // something else, and the choice silently answers to its own wording instead. The keywords are
  // the only place that shows, so they are rendered per choice, with the hint beside them.
  it("shows the words each choice actually answers to, and where tags go", async () => {
    play.mockResolvedValue(
      TURN({
        choices: [
          { text: "Yes, go on", keywords: ["yes", "sure", "go on"], offScript: false },
          { text: "Anything else", keywords: [], offScript: true },
        ],
      }),
    );
    renderEditor({ source: SOURCE, signInLine: "" });
    expect(await screen.findByText(/yes, sure, go on/i, undefined, settle)).toBeTruthy();
    expect(screen.getByText(/must sit INSIDE the choice/i)).toBeTruthy();
    expect(screen.getByText(/catch-all/i)).toBeTruthy();
  });

  it("says so when the story has ended rather than showing an empty list", async () => {
    play.mockResolvedValue(TURN({ choices: [] }));
    renderEditor({ source: SOURCE, signInLine: "" });
    expect(await screen.findByText(/the story has ended here/i, undefined, settle)).toBeTruthy();
  });
});

describe("InkScriptEditor value", () => {
  it("edits the source and the sign-in line", async () => {
    const onChange = renderEditor({ source: "Hi.", signInLine: "" });
    fireEvent.change(screen.getByLabelText(/ink script/i), { target: { value: "Hi there." } });
    expect(onChange.mock.lastCall![0]).toEqual({ source: "Hi there.", signInLine: "" });
    fireEvent.change(screen.getByLabelText(/sign-in line/i), { target: { value: "Sign in." } });
    expect(onChange.mock.lastCall![0]).toEqual({ source: "Hi.", signInLine: "Sign in." });
  });

  // Emptying the editor has to REMOVE the ink, not store a blank one: a config carrying
  // `{ source: "" }` is a persona every reader has to test for a blank source before it can say
  // which engine runs.
  it("clears back to null when both fields are emptied", () => {
    const onChange = renderEditor({ source: "Hi.", signInLine: "" });
    fireEvent.change(screen.getByLabelText(/ink script/i), { target: { value: "   " } });
    expect(onChange.mock.lastCall![0]).toBeNull();
  });

  it("keeps a sign-in line the author wrote before any script", () => {
    const onChange = renderEditor(null);
    fireEvent.change(screen.getByLabelText(/sign-in line/i), { target: { value: "Sign in." } });
    expect(onChange.mock.lastCall![0]).toEqual({ source: "", signInLine: "Sign in." });
  });
});
