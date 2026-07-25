// .../features/personas/src/DemoFacet.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
