// .../features/personas/src/DemoFacet.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEMO_MAX_THINK_MS, DEMO_MAX_TOKEN_MS } from "@agentic-toolkit/data/personas";
import { DEMO_DEFAULT_CONFIG, DemoFacet } from "./DemoFacet";

describe("DemoFacet", () => {
  it("starts from a null config and materializes defaults when switched on", () => {
    const onChange = vi.fn();
    render(<DemoFacet value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enable demo chat/i }));
    expect(onChange).toHaveBeenCalledWith({ ...DEMO_DEFAULT_CONFIG, enabled: true });
  });

  it("keeps the script when switched off, so parking a demo is not destructive", () => {
    const onChange = vi.fn();
    const cfg = { ...DEMO_DEFAULT_CONFIG, enabled: true, script: { ...DEMO_DEFAULT_CONFIG.script, intro: ["keep me"] } };
    render(<DemoFacet value={cfg} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enable demo chat/i }));
    expect(onChange).toHaveBeenCalledWith({ ...cfg, enabled: false });
    expect(onChange.mock.calls[0][0].script.intro).toEqual(["keep me"]);
  });

  it("edits pacing numbers", () => {
    const onChange = vi.fn();
    render(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/think delay/i), { target: { value: "500" } });
    expect(onChange.mock.calls[0][0].pacing.thinkMinMs).toBe(500);
  });

  it("adds a seeded keyword row", () => {
    const onChange = vi.fn();
    render(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add keyword reply/i }));
    expect(onChange.mock.calls[0][0].script.seeded).toEqual([{ match: [], reply: "" }]);
  });

  it("explains that keywords are literal, not regex", () => {
    render(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={vi.fn()} />);
    expect(screen.getByText(/comma-separated words or phrases/i)).toBeTruthy();
  });

  // The server holds the turn's DB transaction open for the whole stream, so it clamps pacing to
  // these ceilings on read. Clamping in the editor too means the author sees the number that will
  // actually be used, instead of typing 35000 and being silently overridden on save.
  it("clamps pacing to the ceilings the server enforces, and advertises them as max", () => {
    const onChange = vi.fn();
    render(<DemoFacet value={{ ...DEMO_DEFAULT_CONFIG, enabled: true }} onChange={onChange} />);
    const think = screen.getByLabelText(/think delay/i);
    expect(think.getAttribute("max")).toBe(String(DEMO_MAX_THINK_MS));
    expect(screen.getByLabelText(/token jitter/i).getAttribute("max")).toBe(String(DEMO_MAX_TOKEN_MS));
    fireEvent.change(think, { target: { value: "35000" } });
    expect(onChange.mock.calls[0][0].pacing.thinkMinMs).toBe(DEMO_MAX_THINK_MS);
    fireEvent.change(screen.getByLabelText(/token delay/i), { target: { value: "9000" } });
    expect(onChange.mock.calls[1][0].pacing.tokenMinMs).toBe(DEMO_MAX_TOKEN_MS);
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
    render(<DemoFacet value={onlyBlanks} onChange={vi.fn()} />);
    expect(screen.getByText(warning)).toBeTruthy();
  });

  it("stays silent once a single usable line exists", () => {
    const usable = {
      ...DEMO_DEFAULT_CONFIG,
      enabled: true,
      script: { ...DEMO_DEFAULT_CONFIG.script, intro: ["Hi, I am the demo."] },
    };
    render(<DemoFacet value={usable} onChange={vi.fn()} />);
    expect(screen.queryByText(warning)).toBeNull();
  });

  it("stays silent for a parked (unticked) script, empty or not", () => {
    // Not enabled is not a mistake — it's an unfinished or deliberately parked draft.
    render(<DemoFacet value={null} onChange={vi.fn()} />);
    expect(screen.queryByText(warning)).toBeNull();
  });
});
