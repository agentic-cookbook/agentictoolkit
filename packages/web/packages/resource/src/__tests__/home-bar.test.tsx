/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeBar, HomeBarHost, HomeBarPortal } from "../home-bar";

describe("HomeBarHost", () => {
  it("renders no strip while nothing claims the bar", () => {
    render(
      <HomeBarHost>
        <p>page</p>
      </HomeBarHost>,
    );
    expect(screen.queryByTestId("home-bar")).toBeNull();
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("renders the strip, above the page content, once a publisher claims it", () => {
    render(
      <HomeBarHost>
        <HomeBarPortal>
          <button type="button">Add</button>
        </HomeBarPortal>
        <p>page</p>
      </HomeBarHost>,
    );
    const strip = screen.getByTestId("home-bar");
    expect(strip).toBeInTheDocument();
    // The control is INSIDE the strip, not where the publisher sits.
    expect(strip).toContainElement(screen.getByRole("button", { name: "Add" }));
    // And the strip precedes the page content in document order — the bar sits
    // above what it acts on, which is the whole point of hoisting it.
    // MASKED, not `toBe`: `compareDocumentPosition` returns a bitmask, and a strict compare
    // holds only while neither node contains the other. The day the strip wraps the content
    // (or vice versa) `toBe` would fail reporting "order wrong" for a containment change.
    expect(
      strip.compareDocumentPosition(screen.getByText("page")) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("drops the strip again when the last publisher unmounts", () => {
    const { rerender } = render(
      <HomeBarHost>
        <HomeBarPortal>
          <button type="button">Add</button>
        </HomeBarPortal>
      </HomeBarHost>,
    );
    expect(screen.getByTestId("home-bar")).toBeInTheDocument();
    rerender(<HomeBarHost>{null}</HomeBarHost>);
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });
});

describe("HomeBarPortal", () => {
  it("renders inline when there is no host above it", () => {
    render(
      <HomeBarPortal>
        <button type="button">Add</button>
      </HomeBarPortal>,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});

describe("HomeBar", () => {
  it("puts left before right in document order", () => {
    render(
      <HomeBar
        left={<input aria-label="Filter" />}
        right={<button type="button">Add</button>}
      />,
    );
    const left = screen.getByLabelText("Filter");
    const right = screen.getByRole("button", { name: "Add" });
    // Masked for the same reason as the strip/content assertion above: a containment change
    // must not be reported as an ordering failure.
    expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pushes the right cluster to the far edge", () => {
    render(<HomeBar right={<button type="button">Add</button>} />);
    // `ml-auto` is what right-justifies the action; the rule is the component's,
    // never re-derived by each feature that puts a button in the bar.
    expect(screen.getByTestId("home-bar-right").className).toContain("ml-auto");
  });

  it("renders only the side it was given", () => {
    render(<HomeBar left={<input aria-label="Filter" />} />);
    expect(screen.queryByTestId("home-bar-right")).toBeNull();
  });

  // The case an omitted prop cannot reach. A caller's natural `right={condition && <X/>}` hands
  // this `false`, not `undefined` — and under the old `right !== undefined` check that drew an
  // empty `ml-auto` div inside a `gap-2` flex row: phantom trailing space, silent, visible only
  // by measuring. `false` (not `null`) is the value JSX's `&&` actually produces, so it is the
  // one worth pinning; the check is truthiness, which covers `null` and `""` alike.
  it("renders no slot wrapper for a FALSY side, not an empty one", () => {
    render(<HomeBar left={<input aria-label="Filter" />} right={false} />);
    expect(screen.getByTestId("home-bar-left")).toBeInTheDocument();
    expect(screen.queryByTestId("home-bar-right")).toBeNull();
  });
});
