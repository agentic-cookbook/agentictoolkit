/// <reference types="@testing-library/jest-dom/vitest" />
//
// Pins Task 5: the Ecosystems card landing's toolbar — its "New …" button, filter field, and
// Cards/List toggle — moves OUT of the landing's own `justify-between` row (Add on the left,
// search+toggle on the right) and into the home bar, where the fleet rule puts search/filters on
// the left and the primary action on the right. `ecosystems` is the only site that reaches this
// component (`ecosystems/src/home-model.tsx` omits `workspaceSlug`, so it has no rail and no
// breadcrumb bar — the home bar sits directly under the workspace bar here).
//
// Harness reused from `resource-explorer.homeBar.test.tsx`: a `HomeBarHost` mounted above the
// component under test, exactly like `SiteHomeShell`/`WorkspaceShellInner` mount it in the
// real fleet, so `HomeBarPortal` finds a real slot instead of taking its no-host inline fallback.
//
// The field is queried by role (`getByRole("searchbox")`) — the selector
// `resource-explorer.homeBar.test.tsx` settled on after `getByLabelText` proved ambiguous there
// (a `role="toolbar"` wrapper carrying its own overlapping `aria-label`). No such wrapper exists
// in this component, so `getByLabelText("Filter")` is also unambiguous here; both are used below
// to cross-check the strip's contents.
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceLanding } from "../resource-landing";
import { HomeBarHost } from "../home-bar";

afterEach(cleanup);
// `chooseView` persists the chosen view mode to `localStorage` keyed by `basePath`
// (`ftd-storage.ts`), and every test in this file shares the same basePath. Without clearing it,
// the last test's click on "View as list" would leak into whichever test runs after it and break
// the assumption that "cards" is the default view.
beforeEach(() => localStorage.clear());

interface Row {
  id: string;
  label: string;
}

function renderLanding({
  items,
  onNew,
  newLabel,
}: {
  items: Row[] | null;
  onNew?: () => void;
  newLabel?: string;
}) {
  return render(
    <HomeBarHost>
      <ResourceLanding<Row>
        items={items}
        title="Child Ecosystems"
        help="help"
        emptyLabel="No ecosystems yet."
        basePath="/home/ecosystems"
        getId={(i) => i.id}
        getLabel={(i) => i.label}
        getSublabel={() => "sub"}
        cardHref={(i) => `/ecosystems/${i.id}`}
        renderMeta={() => null}
        onNew={onNew}
        newLabel={newLabel}
      />
    </HomeBarHost>,
  );
}

describe("ResourceLanding publishes its toolbar into the home bar", () => {
  it("renders its New button, filter, and view toggle in the home bar", async () => {
    renderLanding({
      onNew: () => {},
      newLabel: "New Ecosystem",
      items: [{ id: "a", label: "Alpha" }],
    });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(
      screen.getByRole("button", { name: /New Ecosystem/ }),
    );
    expect(strip).toContainElement(screen.getByRole("searchbox"));
    expect(strip).toContainElement(screen.getByLabelText("Filter"));
    expect(strip).toContainElement(screen.getByLabelText("View as"));
  });

  it("puts the search and the toggle left of the New button", async () => {
    renderLanding({
      onNew: () => {},
      newLabel: "New Ecosystem",
      items: [{ id: "a", label: "Alpha" }],
    });
    const filter = await screen.findByLabelText("Filter");
    const add = screen.getByRole("button", { name: /New Ecosystem/ });
    // MASKED, not `toBe`: `compareDocumentPosition` returns a bitmask, and a strict compare
    // against `DOCUMENT_POSITION_FOLLOWING` holds only while neither node contains the other.
    // The day `HomeBar` nests one slot inside the other, `toBe` would fail reporting "order
    // wrong" for what is actually a containment change.
    expect(
      filter.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits the filter and toggle from the bar when there are no items yet", async () => {
    renderLanding({ onNew: () => {}, newLabel: "New Ecosystem", items: [] });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(
      screen.getByRole("button", { name: /New Ecosystem/ }),
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("claims no bar at all before the list has loaded and there is no onNew", () => {
    renderLanding({ items: null });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  // Guards the class of bug flagged for this task: if `hasItems` read the FILTERED list instead
  // of the raw one, the moment a query matched nothing the bar itself — the strip holding the
  // search box the user just typed into — would unmount, and there would be no control left to
  // clear the query with. `hasItems` is unaffected by `query`, so the bar and its field survive a
  // query that matches nothing.
  it("keeps the filter field mounted when the query matches nothing", async () => {
    renderLanding({
      items: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    });
    const field = await screen.findByRole("searchbox");
    await userEvent.type(field, "zzz-no-match");
    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(await screen.findByTestId("home-bar")).toContainElement(
      screen.getByRole("searchbox"),
    );
  });

  it("still filters the landing's rows from the bar's field", async () => {
    renderLanding({
      items: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    });
    const field = await screen.findByRole("searchbox");
    expect(await screen.findByTestId("home-bar")).toContainElement(field);
    await userEvent.type(field, "Alph");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("still switches between the cards and list views from the bar's toggle", async () => {
    renderLanding({
      items: [{ id: "a", label: "Alpha" }],
    });
    await screen.findByTestId("home-bar");
    // The card view renders the label inside a card `<div>`; the list view renders a
    // plain `<ul>`. Cards is the default, so asserting the list markup appears after the click is
    // enough to prove the toggle in the bar still drives this component's own `view` state. The
    // toggle item's accessible name is its `aria-label` ("View as list"), not its `title`
    // ("List") — `aria-label` wins the accessible-name computation, so that is what the query
    // below has to match.
    expect(screen.queryByRole("list")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "View as list" }));
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
