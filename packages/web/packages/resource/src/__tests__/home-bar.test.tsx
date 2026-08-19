/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeBar, HomeBarHost, HomeBarPortal, HomeBarTaken } from "../home-bar";

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

// The nesting rule. Features mount features — organizations renders TeamsFeature inside a topic,
// the hub's Products list mounts ProjectsFeature — and each brings its own explorer and its own
// bar. Both used to claim, both portalled into the same node, and the two sets of controls
// interleaved with the outer `ml-auto` eating all the slack. The OUTER one wins, and it has to be
// settled by depth: layout effects run child-first, so the inner publisher always claims first.
describe("HomeBarTaken", () => {
  it("keeps a nested publisher out of the strip and renders it inline instead", () => {
    render(
      <HomeBarHost>
        <HomeBarPortal>
          <button type="button">Outer Add</button>
        </HomeBarPortal>
        <HomeBarTaken>
          <p>topic pane</p>
          <HomeBarPortal>
            <button type="button">Inner Add</button>
          </HomeBarPortal>
        </HomeBarTaken>
      </HomeBarHost>,
    );
    const strip = screen.getByTestId("home-bar");
    const inner = screen.getByRole("button", { name: "Inner Add" });
    expect(strip).toContainElement(screen.getByRole("button", { name: "Outer Add" }));
    // Present — standing down must not DELETE the nested feature's controls…
    expect(inner).toBeInTheDocument();
    // …but not in the bar.
    expect(strip).not.toContainElement(inner);
  });

  it("leaves the bar to the nested publisher when the outer one publishes nothing", () => {
    render(
      <HomeBarHost>
        <HomeBarTaken taken={false}>
          <HomeBarPortal>
            <button type="button">Inner Add</button>
          </HomeBarPortal>
        </HomeBarTaken>
      </HomeBarHost>,
    );
    expect(screen.getByTestId("home-bar")).toContainElement(
      screen.getByRole("button", { name: "Inner Add" }),
    );
  });

  // `above || taken`, not `taken`: a nested provider must never HAND BACK a bar an ancestor holds.
  // Organizations publishes, its teams explorer does not, and the teams explorer's own topic pane
  // must still not reach the strip.
  it("does not release a bar an ancestor holds", () => {
    render(
      <HomeBarHost>
        <HomeBarPortal>
          <button type="button">Outer Add</button>
        </HomeBarPortal>
        <HomeBarTaken>
          <HomeBarTaken taken={false}>
            <HomeBarPortal>
              <button type="button">Inner Add</button>
            </HomeBarPortal>
          </HomeBarTaken>
        </HomeBarTaken>
      </HomeBarHost>,
    );
    expect(screen.getByTestId("home-bar")).not.toContainElement(
      screen.getByRole("button", { name: "Inner Add" }),
    );
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

  // The layout rule has to travel with the markup: a publisher standing down under
  // `HomeBarTaken`, or one on a page with no host, renders these same children into whatever
  // container the feature sits in — usually a `flex-col`, which stacks the two sides vertically and
  // leaves `ml-auto` doing nothing.
  it("carries its own flex row rather than trusting the strip it lands in", () => {
    render(<HomeBar left={<input aria-label="Filter" />} />);
    const row = screen.getByTestId("home-bar-left").parentElement;
    expect(row?.className).toContain("flex");
    expect(row?.className).toContain("items-center");
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

  // The falsy value `&&` does NOT discard. `count && <Chip/>` yields `0` when the count is zero,
  // and React renders `0` as text — under an `&&` gate that text lands in the strip itself,
  // outside both slot divs. The ternary drops it. Asserting the absent TEXT as well as the absent
  // wrapper is the point: the wrapper is already absent under `&&`, so only the text discriminates.
  it("renders neither a wrapper nor a stray character for a numeric-zero side", () => {
    const { container } = render(<HomeBar left={<input aria-label="Filter" />} right={0} />);
    expect(screen.queryByTestId("home-bar-right")).toBeNull();
    expect(container.textContent).not.toContain("0");
  });
});
