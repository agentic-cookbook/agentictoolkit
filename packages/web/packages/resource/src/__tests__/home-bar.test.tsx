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
    expect(strip.compareDocumentPosition(screen.getByText("page"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
    expect(left.compareDocumentPosition(right)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
});
