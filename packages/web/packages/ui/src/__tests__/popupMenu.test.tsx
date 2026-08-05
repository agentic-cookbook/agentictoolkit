import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PopupMenu } from "../blocks/popup-menu";

// Trigger-only assertions: the menu is never opened. The dropdown is Base UI
// (@base-ui/react/menu), whose open/close needs pointer plumbing, and
// @testing-library/user-event is not a devDependency of this package. Nothing here needs
// the menu open — both new props live on the trigger.

const items = [
  { id: "acme", label: "Acme" },
  { id: "globex", label: "Globex" },
];

describe("PopupMenu trigger customisation", () => {
  it("renders the default chevron when no icon is given", () => {
    const { container } = render(
      <PopupMenu items={items} selectedId="acme" onSelect={vi.fn()} ariaLabel="Workspace" />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a supplied icon instead of the default", () => {
    const { container } = render(
      <PopupMenu
        items={items}
        selectedId="acme"
        onSelect={vi.fn()}
        ariaLabel="Workspace"
        icon={<span data-testid="caret">v</span>}
      />,
    );
    expect(screen.getByTestId("caret")).toBeInTheDocument();
    // "instead of the default" — the sibling test above already proves the default chevron
    // renders an <svg>, so this is the free falsifying check: if the icon were unioned in
    // alongside the default (`??` swapped for rendering both) rather than replacing it, this
    // would still find the chevron's svg and fail.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("merges a trigger className over the block's own width", () => {
    render(
      <PopupMenu
        items={items}
        selectedId="acme"
        onSelect={vi.fn()}
        ariaLabel="Workspace"
        className="w-auto"
      />,
    );
    const trigger = screen.getByLabelText("Workspace");
    expect(trigger.className).toContain("w-auto");
    // tailwind-merge drops the conflicting w-full rather than leaving both.
    expect(trigger.className).not.toContain("w-full");
  });
});
