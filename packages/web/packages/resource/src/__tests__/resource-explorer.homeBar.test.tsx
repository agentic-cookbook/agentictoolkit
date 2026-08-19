/// <reference types="@testing-library/jest-dom/vitest" />
//
// Pins Task 4: the resource rail's filter and its "New …" button move OUT of the rail header
// (`headerSlot`/`onNew` on the top-level `resourceLevel`) and into the home bar — the strip a
// `HomeBarHost` draws above the rails, shared by eleven fleet sites. The important test is the
// last one: it proves the field the bar renders is still the SAME `filter` state that narrows the
// rail's rows, i.e. that `HomeBarPortal` moved the control's DOM position without cutting it out
// of ResourceExplorer's React tree.
//
// Harness reused from `resource-explorer-standalone.test.tsx` (the router mock + minimal
// ResourceExplorer props) and `home-bar.test.tsx` (mounting a `HomeBarHost` above the publisher so
// the portal has a real slot to land in instead of taking its no-host inline fallback).
//
// The field is queried by role (`getByRole("searchbox")`, the accessible role a native
// `<input type="search">` carries), not by label text: the strip's `ButtonBar` wrapper — in the
// component under test before this file's fix, and still the shape a naive re-read of
// `ListHeader`'s source might suggest — carries its OWN `aria-label` on a `role="toolbar"` div,
// which also matches a loose `/filter/i` text query and makes `getByLabelText` ambiguous.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceExplorer, type ResourceTopic } from "../resource-explorer";
import { HomeBarHost } from "../home-bar";

// ResourceExplorer calls next/navigation's useRouter unconditionally; the explorer's own
// select/prefetch wiring isn't under test here, so a minimal no-op double is enough — mirrors
// resource-explorer-standalone.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

afterEach(cleanup);

interface Row {
  id: string;
  label: string;
}

const NO_TOPICS: ResourceTopic[] = [];

function renderExplorer({
  items,
  newLabel,
  promoteTopics = false,
}: {
  items: Row[] | null;
  newLabel?: string;
  /** Exercises the `!promoteTopics` guard — see the last test below. */
  promoteTopics?: boolean;
}) {
  // A HomeBarHost above the explorer, exactly like SiteHomeShell/WorkspaceChromeProvider mount in
  // the real fleet: without one HomeBarPortal takes its no-host inline fallback and every
  // assertion about `home-bar` below would fail for the wrong reason (no host, not a bug in the
  // explorer's publish).
  return render(
    <HomeBarHost>
      <ResourceExplorer<Row>
        promoteTopics={promoteTopics}
        basePath="/home"
        items={items}
        getId={(i) => i.id}
        getLabel={(i) => i.label}
        nameSuffix="Project"
        topics={NO_TOPICS}
        newLabel={newLabel}
        rail={{ title: "All", help: "help", emptyLabel: "None yet." }}
      />
    </HomeBarHost>,
  );
}

describe("ResourceExplorer publishes into the home bar", () => {
  it("renders its filter and its New button in the home bar, not the rail header", async () => {
    renderExplorer({ newLabel: "New Project…", items: [{ id: "a", label: "Alpha" }] });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("searchbox"));
    expect(strip).toContainElement(screen.getByRole("button", { name: /New Project/ }));
  });

  it("omits the New button from the bar when the host suppressed creation", async () => {
    renderExplorer({ items: [{ id: "a", label: "Alpha" }] }); // no newLabel
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("searchbox"));
    expect(screen.queryByRole("button", { name: /New/ })).toBeNull();
  });

  it("claims no bar at all before the list has loaded", () => {
    renderExplorer({ items: null });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  // The `!promoteTopics` guard is the one piece of judgement in this change: `resourceLevel` (the
  // level these controls used to live on) is only ever spliced into `levels` when `!promoteTopics`,
  // so a promoteTopics host never rendered them before, however loaded/populated `items` was — and
  // EcosystemsFeature's own promoteTopics mount passes a `newLabel` with no `renderDialog`, so a
  // button that opened nothing is exactly what dropping this guard would have shipped.
  it("claims no bar at all in promoteTopics mode, even with items and a newLabel", () => {
    renderExplorer({
      promoteTopics: true,
      newLabel: "New Ecosystem…",
      items: [{ id: "a", label: "Alpha" }],
    });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  it("still filters the rail's rows from the bar's field", async () => {
    renderExplorer({
      items: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    });
    const field = await screen.findByRole("searchbox");
    // Not just that the field exists somewhere — that it is IN the bar. Without this, the test
    // below can't tell a real portal apart from HomeBarPortal's no-host inline fallback: both
    // leave the field in the explorer's React tree, so both would filter the rows identically.
    expect(await screen.findByTestId("home-bar")).toContainElement(field);
    await userEvent.type(field, "Alph");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).toBeNull();
  });
});
