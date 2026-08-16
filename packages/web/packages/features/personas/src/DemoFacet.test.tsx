// .../features/personas/src/DemoFacet.test.tsx
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { DEMO_MAX_THINK_MS, DEMO_MAX_TOKEN_MS } from "@agentic-toolkit/data/personas";
import { DEMO_DEFAULT_CONFIG, DemoFacet } from "./DemoFacet";

// The facet now nests the ink editor, which lints the draft through the server. Its own
// behaviour is pinned in InkScriptEditor.test.tsx; here the call is stubbed so these tests
// stay about the facet, and so nothing reaches the network. The rest of the module is real —
// `canDemoChat` and the pacing ceilings are what several assertions below are about.
vi.mock("@agentic-toolkit/data/personas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data/personas")>();
  return { ...actual, demoPreviewApi: { play: vi.fn(async () => null as never) } };
});

// The ink editor uses react-query, whose provider must be the TOOLKIT's copy (see
// data/src/query) — the host's would be a different context entirely.
const renderFacet = (ui: ReactElement) => render(<ToolkitQueryProvider>{ui}</ToolkitQueryProvider>);

describe("DemoFacet", () => {
  it("starts from a null config and materializes defaults when switched on", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enable demo chat/i }));
    expect(onChange).toHaveBeenCalledWith({ ...DEMO_DEFAULT_CONFIG, enabled: true });
  });

  it("keeps the script when switched off, so parking a demo is not destructive", () => {
    const onChange = vi.fn();
    const cfg = { ...DEMO_DEFAULT_CONFIG, enabled: true, script: { ...DEMO_DEFAULT_CONFIG.script, intro: ["keep me"] } };
    renderFacet(<DemoFacet value={cfg} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enable demo chat/i }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, enabled: false });
    expect(onChange.mock.calls[0][0].script.intro).toEqual(["keep me"]);
  });

  it("edits pacing numbers", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/think delay/i), { target: { value: "500" } });
    expect(onChange.mock.calls[0][0].pacing.thinkMinMs).toBe(500);
  });

  it("adds a seeded keyword row", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add keyword reply/i }));
    expect(onChange.mock.calls[0][0].script.seeded).toEqual([{ match: [], reply: "" }]);
  });

  it("explains that keywords are literal, not regex", () => {
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={vi.fn()} />);
    expect(screen.getByText(/comma-separated words or phrases/i)).toBeTruthy();
  });

  // The server holds the turn's DB transaction open for the whole stream, so it clamps pacing to
  // these ceilings on read. Clamping in the editor too means the author sees the number that will
  // actually be used, instead of typing 35000 and being silently overridden on save.
  it("clamps pacing to the ceilings the server enforces, and advertises them as max", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    const think = screen.getByLabelText(/think delay/i);
    expect(think.getAttribute("max")).toBe(String(DEMO_MAX_THINK_MS));
    expect(screen.getByLabelText(/token jitter/i).getAttribute("max")).toBe(String(DEMO_MAX_TOKEN_MS));
    fireEvent.change(think, { target: { value: "35000" } });
    fireEvent.blur(think);
    expect(onChange.mock.lastCall![0].pacing.thinkMinMs).toBe(DEMO_MAX_THINK_MS);
    const token = screen.getByLabelText(/token delay/i);
    fireEvent.change(token, { target: { value: "9000" } });
    fireEvent.blur(token);
    expect(onChange.mock.lastCall![0].pacing.tokenMinMs).toBe(DEMO_MAX_TOKEN_MS);
  });

  // Clamping on every keystroke fought the author: 35000 is also what you pass THROUGH on the way
  // to 3500, and snapping it to the ceiling mid-word moved the caret out from under them.
  it("does not clamp mid-keystroke, only when the field is left", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    const think = screen.getByLabelText(/think delay/i);
    fireEvent.change(think, { target: { value: "35000" } });
    expect(onChange.mock.lastCall![0].pacing.thinkMinMs).toBe(35000);
    fireEvent.change(think, { target: { value: "3500" } });
    fireEvent.blur(think);
    expect(onChange.mock.lastCall![0].pacing.thinkMinMs).toBe(3500);
  });

  // `Number("")` is 0, so a directly-controlled field turned "select all, retype" into a write of
  // 0 plus a re-render of "0" under the caret. The draft holds the empty string instead.
  it("leaves the stored value alone while the box is empty mid-edit", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    const think = screen.getByLabelText(/think delay/i);
    fireEvent.change(think, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect((think as HTMLInputElement).value).toBe("");
    // ...and a half-typed exponent is NaN, which would reach the server's pacing math.
    fireEvent.change(think, { target: { value: "1e" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  // The stored form is an array; the edited form is text. Round-tripping through the array on
  // every keystroke deleted the separator as it was typed.
  it("keeps the comma and the space you type between keywords", () => {
    const onChange = vi.fn();
    const cfg = {
      ...DEMO_DEFAULT_CONFIG,
      enabled: true,
      script: { ...DEMO_DEFAULT_CONFIG.script, seeded: [{ match: ["matrix"], reply: "r" }] },
    };
    renderFacet(<DemoFacet value={cfg} onChange={onChange} />);
    const keywords = screen.getByLabelText(/keywords/i) as HTMLInputElement;
    fireEvent.change(keywords, { target: { value: "matrix, " } });
    expect(keywords.value).toBe("matrix, ");
    // The parse still runs every keystroke, so the row is saveable without blurring first.
    expect(onChange.mock.lastCall![0].script.seeded[0].match).toEqual(["matrix"]);
    fireEvent.change(keywords, { target: { value: "matrix, rain" } });
    expect(onChange.mock.lastCall![0].script.seeded[0].match).toEqual(["matrix", "rain"]);
  });

  // With no fallbacks the exhaustion pool widens to the intro and seeded lines themselves
  // (backend selectReply), so a keyword reply can answer a message matching none of its keywords.
  it("discloses that keyword replies get reused when there are no fallbacks", () => {
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={vi.fn()} />);
    expect(screen.getByText(/matches none of its keywords/i)).toBeTruthy();
  });
});

// Enabled + nothing sayable is the state the shortest path through this editor produces: tick the
// box, click Add, save without typing. The server asks canDemoChat before it claims a turn, so
// such a persona quietly does NOT demo — the author has no way to see that from here otherwise.
describe("DemoFacet unanswerable-script warning", () => {
  const warning = /no line the persona can say/i;

  it("warns when demo is on but the script cannot answer", () => {
    const onlyBlanks = {
      ...DEMO_DEFAULT_CONFIG,
      enabled: true,
      script: { intro: ["", "   "], seeded: [{ match: [], reply: "" }], fallbacks: [], onExhausted: "reshuffle" as const },
    };
    renderFacet(<DemoFacet value={onlyBlanks} onChange={vi.fn()} />);
    expect(screen.getByText(warning)).toBeTruthy();
  });

  it("stays silent once a single usable line exists", () => {
    const usable = {
      ...DEMO_DEFAULT_CONFIG,
      enabled: true,
      script: { ...DEMO_DEFAULT_CONFIG.script, intro: ["Hi, I am the demo."] },
    };
    renderFacet(<DemoFacet value={usable} onChange={vi.fn()} />);
    expect(screen.queryByText(warning)).toBeNull();
  });

  it("stays silent for a parked (unticked) script, empty or not", () => {
    // Not enabled is not a mistake — it's an unfinished or deliberately parked draft.
    renderFacet(<DemoFacet value={null} onChange={vi.fn()} />);
    expect(screen.queryByText(warning)).toBeNull();
  });
});

// Which engine runs is the server's rule — an ink source that isn't blank wins — so the facet
// reports it rather than offering a switch. A switch would be a second record of the same fact,
// free to disagree with the config that actually ships.
describe("DemoFacet engine", () => {
  const withInk = (source: string) => ({
    ...DEMO_DEFAULT_CONFIG,
    enabled: true,
    ink: { source, signInLine: "" },
  });

  it("says the keyword fields run when there is no ink", () => {
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={vi.fn()} />);
    expect(screen.getByText("Keywords")).toBeTruthy();
    expect(screen.getByText(/demos on the keyword fields/i)).toBeTruthy();
  });

  it("says the ink script runs once one is written", () => {
    renderFacet(<DemoFacet value={withInk("Hi.\n-> DONE\n")} onChange={vi.fn()} />);
    expect(screen.getByText("Ink")).toBeTruthy();
    expect(screen.getByText(/demos on its ink script/i)).toBeTruthy();
  });

  // A source of nothing but whitespace is a draft the author opened and never wrote — the
  // server reads it as absent (`inkCanSpeak`), so the facet must not claim ink is running.
  it("treats a whitespace-only source as no ink at all", () => {
    renderFacet(<DemoFacet value={withInk("   \n")} onChange={vi.fn()} />);
    expect(screen.getByText("Keywords")).toBeTruthy();
  });

  it("writes the ink back into the config it was given", () => {
    const onChange = vi.fn();
    renderFacet(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/ink script/i), { target: { value: "Hi." } });
    expect(onChange.mock.lastCall![0].ink).toEqual({ source: "Hi.", signInLine: "" });
    // ...without disturbing the keyword script it sits beside.
    expect(onChange.mock.lastCall![0].script).toEqual(DEMO_DEFAULT_CONFIG.script);
  });
});
