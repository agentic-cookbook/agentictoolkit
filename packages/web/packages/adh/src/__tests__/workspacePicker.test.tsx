import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspacePicker } from "../home/WorkspacePicker";

// Trigger-only assertions, like popupMenu.test.tsx: the Base UI menu is never opened. What
// matters here is the two pre-selection states, which ride on PopupMenu's `allLabel` (its
// empty-selection trigger text) rather than on a prop of their own.

const WORKSPACES = [
  { slug: "mine", name: "My Workspace", kind: "individual" as const },
  { slug: "acme", name: "Acme", kind: "organization" as const },
];

describe("WorkspacePicker", () => {
  it("shows the selected workspace's NAME, not its slug", () => {
    render(<WorkspacePicker workspaces={WORKSPACES} selected="acme" onSelect={vi.fn()} />);
    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Acme");
  });

  it("says Loading… while the list is null", () => {
    render(<WorkspacePicker workspaces={null} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText("Workspace")).toHaveTextContent("Loading…");
  });

  it("says No workspaces when the list is empty", () => {
    render(<WorkspacePicker workspaces={[]} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByLabelText("Workspace")).toHaveTextContent("No workspaces");
  });

  it(
    "[final review, M-1] says Loading… when the list has loaded and is non-empty but nothing " +
      "is selected yet — the 5s prefs-settle window",
    () => {
      // A third reachable state `allLabel` used to miss: workspaces loaded and non-empty, but
      // `selected` still null because SiteHomeShell hasn't resolved a workspace (its prefs GET
      // hasn't settled and there's no URL slug). The old two-branch ternary fell through to
      // `null` here, which PopupMenu reads as "render nothing selected" — a blank trigger, not
      // a loading state.
      render(<WorkspacePicker workspaces={WORKSPACES} selected={null} onSelect={vi.fn()} />);
      expect(screen.getByLabelText("Workspace")).toHaveTextContent("Loading…");
    },
  );

  it("passes a trigger className through to PopupMenu", () => {
    render(
      <WorkspacePicker
        workspaces={WORKSPACES}
        selected="acme"
        onSelect={vi.fn()}
        className="w-auto"
      />,
    );
    expect(screen.getByLabelText("Workspace").className).toContain("w-auto");
  });
});
