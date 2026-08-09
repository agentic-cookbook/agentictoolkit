/** Unit tests for CommandPalette (blocks/command-palette).
 *
 *  Real Base-UI Dialog in jsdom (the package-local vitest.setup patches getComputedStyle for it).
 *  Keyboard goes to the field, which is where a palette's keyboard lives — the list is never
 *  focused, it is driven through aria-activedescendant. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useState, type ReactElement } from "react";
import {
  CommandPalette,
  filterCommandItems,
  type CommandGroup,
  type CommandItem,
} from "../blocks/command-palette";

const item = (id: string, label: string, extra: Partial<CommandItem> = {}): CommandItem => ({
  id,
  label,
  onSelect: vi.fn(),
  ...extra,
});

const GROUPS: CommandGroup[] = [
  { id: "work-items", label: "Work items", items: [item("w1", "Ship the thing"), item("w2", "Write the copy")] },
  { id: "go-to", label: "Go to", items: [item("t1", "Milestones")] },
];

/** The palette with its query wired to state, the way a host owns it. */
function Harness({
  groups = GROUPS,
  onOpenChange = vi.fn(),
  ...rest
}: Partial<React.ComponentProps<typeof CommandPalette>>): ReactElement {
  const [query, setQuery] = useState("");
  return (
    <CommandPalette
      open
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      ariaLabel="Find anything"
      {...rest}
    />
  );
}

const field = (): HTMLInputElement => screen.getByRole("combobox", { name: "Find anything" });
const rows = (): HTMLElement[] => screen.getAllByRole("option");
const highlighted = (): HTMLElement | null => document.querySelector("[data-highlighted]");

describe("CommandPalette — structure", () => {
  it("renders each non-empty group as a named group of options", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Work items" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Go to" })).toBeInTheDocument();
    expect(rows().map((r) => r.textContent)).toEqual(["Ship the thing", "Write the copy", "Milestones"]);
  });

  it("drops an EMPTY group, so a host may declare its groups unconditionally", () => {
    render(<Harness groups={[GROUPS[0]!, { id: "projects", label: "Projects", items: [] }]} />);
    expect(screen.queryByRole("group", { name: "Projects" })).toBeNull();
    expect(screen.getByRole("group", { name: "Work items" })).toBeInTheDocument();
  });

  it("does NOT filter what it was handed — a remote hit that matched on something invisible stays", () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: "zzz-no-label-contains-this" } });
    expect(rows()).toHaveLength(3);
  });

  it("shows a badge, a description and a hint when the item carries them", () => {
    render(
      <Harness
        groups={[
          {
            id: "g",
            label: "Work items",
            items: [item("w1", "Ship the thing", { badge: "ADH-42", description: "…the landing page…", hint: "Website relaunch" })],
          },
        ]}
      />,
    );
    const row = screen.getByRole("option");
    expect(row).toHaveTextContent("ADH-42");
    expect(row).toHaveTextContent("…the landing page…");
    expect(row).toHaveTextContent("Website relaunch");
  });
});

describe("CommandPalette — keyboard", () => {
  it("preselects the first row, so `type, Enter` is the whole interaction", () => {
    render(<Harness />);
    expect(highlighted()).toHaveTextContent("Ship the thing");
    expect(field()).toHaveAttribute("aria-activedescendant", rows()[0]!.id);
  });

  it("moves through the rows as ONE list, across the group boundary", () => {
    render(<Harness />);
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(highlighted()).toHaveTextContent("Write the copy");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    // Into the next group without stopping at its heading.
    expect(highlighted()).toHaveTextContent("Milestones");
  });

  it("wraps at both ends", () => {
    render(<Harness />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(highlighted()).toHaveTextContent("Milestones");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(highlighted()).toHaveTextContent("Ship the thing");
  });

  it("jumps to the ends with Home and End", () => {
    render(<Harness />);
    fireEvent.keyDown(field(), { key: "End" });
    expect(highlighted()).toHaveTextContent("Milestones");
    fireEvent.keyDown(field(), { key: "Home" });
    expect(highlighted()).toHaveTextContent("Ship the thing");
  });

  it("runs the highlighted row on Enter and closes", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Harness
        onOpenChange={onOpenChange}
        groups={[{ id: "g", label: "Work items", items: [item("w1", "Ship the thing"), item("w2", "Write the copy", { onSelect })] }]}
      />,
    );
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does nothing on Enter with an empty list", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} groups={[]} />);
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on Escape — through the dialog, which owns that key", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.keyDown(field(), { key: "Escape" });
    // Base UI hands its own event detail as a second argument; only the first is ours.
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});

describe("CommandPalette — the highlight and the result set", () => {
  it("resets to the top when the ROWS change, but not on an unrelated re-render", () => {
    const { rerender } = render(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        groups={GROUPS}
        ariaLabel="Find anything"
      />,
    );
    fireEvent.keyDown(field(), { key: "End" });
    expect(highlighted()).toHaveTextContent("Milestones");

    // Same ids, new render — an arrow-key position the user chose must survive it.
    rerender(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        groups={GROUPS}
        ariaLabel="Find anything"
        placeholder="…"
      />,
    );
    expect(highlighted()).toHaveTextContent("Milestones");

    rerender(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        query="x"
        onQueryChange={vi.fn()}
        groups={[{ id: "g", label: "Work items", items: [item("w9", "Something else")] }]}
        ariaLabel="Find anything"
      />,
    );
    expect(highlighted()).toHaveTextContent("Something else");
  });

  it("follows the mouse, so clicking never runs a row other than the one under the pointer", () => {
    const onSelect = vi.fn();
    render(<Harness groups={[{ id: "g", label: "Work items", items: [item("w1", "Ship the thing"), item("w2", "Write the copy", { onSelect })] }]} />);
    fireEvent.mouseEnter(rows()[1]!);
    expect(highlighted()).toHaveTextContent("Write the copy");
    fireEvent.click(rows()[1]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("CommandPalette — loading, empty, error", () => {
  it("shows the search in flight BESIDE what is already listed", () => {
    render(<Harness loading />);
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it("shows the empty label only when nothing is listed and nothing is loading", () => {
    const { rerender } = render(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        query="zz"
        onQueryChange={vi.fn()}
        groups={[]}
        ariaLabel="Find anything"
        emptyLabel="No matches"
      />,
    );
    expect(screen.getByText("No matches")).toBeInTheDocument();

    rerender(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        query="zz"
        onQueryChange={vi.fn()}
        groups={[]}
        ariaLabel="Find anything"
        emptyLabel="No matches"
        loading
      />,
    );
    expect(screen.queryByText("No matches")).toBeNull();
  });

  it("shows an error instead of claiming there is nothing to find", () => {
    render(<Harness groups={[]} error="Search is unavailable." emptyLabel="No matches" />);
    expect(screen.getByText("Search is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).toBeNull();
  });

  it("renders a footer only when given one", () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByText("↵ to open")).toBeNull();
    rerender(<Harness footer={<span>↵ to open</span>} />);
    expect(screen.getByText("↵ to open")).toBeInTheDocument();
  });
});

describe("filterCommandItems", () => {
  const items = [
    item("a", "Milestones", { description: "The board's plan" }),
    item("b", "Work items", { keywords: "cards issues" }),
    item("c", "Overview", { badge: "ADH-42" }),
  ];

  it("returns everything for a blank query", () => {
    expect(filterCommandItems(items, "   ").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("matches case-insensitively across label, keywords, badge and description", () => {
    expect(filterCommandItems(items, "MILE").map((i) => i.id)).toEqual(["a"]);
    expect(filterCommandItems(items, "issues").map((i) => i.id)).toEqual(["b"]);
    expect(filterCommandItems(items, "adh-4").map((i) => i.id)).toEqual(["c"]);
    expect(filterCommandItems(items, "the board's").map((i) => i.id)).toEqual(["a"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterCommandItems(items, "tungsten")).toEqual([]);
  });
});
