// @vitest-environment jsdom
//
// The multi-select filter behind every list's Type/Reason/Role menu.
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FacetMenu } from "../blocks/facet-menu";

afterEach(cleanup);

const OPTIONS = ["app", "org", "storage"];

function setup(overrides: Partial<React.ComponentProps<typeof FacetMenu>> = {}) {
  const onChange = vi.fn();
  render(
    <FacetMenu
      label="Type"
      options={OPTIONS}
      selected={new Set()}
      onChange={onChange}
      {...overrides}
    />,
  );
  const trigger = screen.getByRole("button", { name: /^Type/ }) as HTMLButtonElement;
  return { onChange, trigger, open: () => fireEvent.click(trigger) };
}

describe("the trigger", () => {
  it("says how many values are narrowing the list", () => {
    // Not decoration: a filter whose entire UI is hidden behind a click is a filter the operator
    // forgets is on, and then reads a short list as "these are all the rows there are" — on a
    // list with a Delete button above it, that is the prelude to acting on the wrong set.
    const { trigger } = setup({ selected: new Set(["org", "app"]) });
    expect(trigger.textContent).toContain("Type (2)");
  });

  it("says nothing when nothing is ticked", () => {
    expect(setup().trigger.textContent?.trim()).toBe("Type");
  });

  it("is disabled when the list contains no values to filter by", () => {
    expect(setup({ options: [] }).trigger.disabled).toBe(true);
  });
});

describe("ticking", () => {
  it("adds a value without disturbing the others", () => {
    const { open, onChange } = setup({ selected: new Set(["app"]) });
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "storage" }));
    expect([...onChange.mock.calls[0]![0]].sort()).toEqual(["app", "storage"]);
  });

  it("unticks a value that is already ticked", () => {
    const { open, onChange } = setup({ selected: new Set(["app", "storage"]) });
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "app" }));
    expect([...onChange.mock.calls[0]![0]]).toEqual(["storage"]);
  });

  it("shows the display name while reporting the raw value", () => {
    const { open, onChange } = setup({
      options: ["renamed"],
      labelOf: (v) => `Renamed (${v})`,
    });
    open();
    const box = screen.getByRole("checkbox", { name: "Renamed (renamed)" });
    fireEvent.click(box);
    expect([...onChange.mock.calls[0]![0]]).toEqual(["renamed"]);
  });
});

describe("All and None", () => {
  it("All ticks every option", () => {
    // The start of "everything except this one", which is how an operator excludes a single
    // value — so the boxes have to actually be ticked.
    const { open, onChange } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect([...onChange.mock.calls[0]![0]].sort()).toEqual(OPTIONS);
  });

  it("None clears the selection", () => {
    const { open, onChange } = setup({ selected: new Set(["app"]) });
    open();
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect([...onChange.mock.calls[0]![0]]).toEqual([]);
  });

  it("disables each when it would change nothing", () => {
    setup({ selected: new Set() });
    fireEvent.click(screen.getByRole("button", { name: /^Type/ }));
    expect((screen.getByRole("button", { name: "None" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "All" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
