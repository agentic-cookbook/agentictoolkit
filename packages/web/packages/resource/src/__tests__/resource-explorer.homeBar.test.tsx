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
//
// Also pins Task 6 fix round 1's Critical #1: `homeBarRight` is the seam a host that creates by
// NAVIGATION (games) uses instead of a second `HomeBarPortal` of its own — the bug round 1 shipped
// was exactly that second portal, landing two `HomeBar`s in the one slot div. The `homeBarRight`
// describe block below exercises the widened publish gate this prop required: the bar must appear
// even with zero/unloaded items (a navigating host has no OTHER way to show its control), but the
// FILTER FIELD must not — there is nothing loaded to filter yet.
import type { ReactNode } from "react";
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
  homeBarRight,
}: {
  items: Row[] | null;
  newLabel?: string;
  /** Exercises the `!promoteTopics` guard — see the last test below. */
  promoteTopics?: boolean;
  /** A host's own right-side control — see the `homeBarRight` describe block below. */
  homeBarRight?: ReactNode;
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
        homeBarRight={homeBarRight}
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

  // Pins the OTHER half of the widened gate (`hasEntities || Boolean(homeBarRight)`): a loaded
  // but EMPTY list, with no `homeBarRight` to keep the bar open. This is the test the comment
  // inside the `homeBarRight` describe block below (on the zero-items-WITH-homeBarRight case)
  // means by "without homeBarRight this state claims no bar at all" — it fails if someone later
  // drops `hasEntities` from that `||` and leaves only the `homeBarRight` clause.
  it("claims no bar at all with a loaded but empty list and no homeBarRight", () => {
    renderExplorer({ items: [] });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  // The `!promoteTopics` guard is the one piece of judgement in this change: `resourceLevel` (the
  // level the FILTER FIELD used to live on) is only ever spliced into `levels` when
  // `!promoteTopics`, so a promoteTopics host never rendered it before, however loaded/populated
  // `items` was — and EcosystemsFeature's own promoteTopics mount passes a `newLabel` with no
  // `renderDialog`, so a button that opened nothing is exactly what dropping this guard would have
  // shipped for the field/newLabel case this test covers.
  //
  // That guard is narrower than this test's title suggests, though: it is on `hasEntities`, which
  // gates the FILTER FIELD (and, via `hasEntities ||`, the bar as a whole when nothing else keeps
  // it open) — not on `homeBarRight`, which bypasses it on purpose (see that prop's doc in
  // resource-explorer.tsx). A promoteTopics host that passes `homeBarRight` DOES get a bar; this
  // render passes none, so it stays green and still pins the field/newLabel half of the invariant.
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

describe("ResourceExplorer's homeBarRight — a host's own right-side control", () => {
  it("renders homeBarRight in the bar", async () => {
    renderExplorer({
      items: [{ id: "a", label: "Alpha" }],
      homeBarRight: <button type="button">Host Action</button>,
    });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("button", { name: "Host Action" }));
  });

  it("publishes the bar even with zero items, and with NO searchbox, when homeBarRight is given", async () => {
    renderExplorer({
      items: [],
      homeBarRight: <button type="button">Host Action</button>,
    });
    // Without homeBarRight this state claims no bar at all (see "claims no bar at all with a
    // loaded but empty list and no homeBarRight" above) — an empty list has nothing to filter.
    // With it, the bar must still appear: a host that creates by navigation, like games, has no
    // other way to show its control on an empty workspace.
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("button", { name: "Host Action" }));
    // But the FILTER FIELD stays gated on there being something loaded to filter — homeBarRight
    // widens the BAR's gate, not the field's.
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("keeps left (filter) before right (homeBarRight) in ONE HomeBar call, not two", async () => {
    renderExplorer({
      items: [{ id: "a", label: "Alpha" }],
      newLabel: "New Project…",
      homeBarRight: <button type="button">Host Action</button>,
    });
    const strip = await screen.findByTestId("home-bar");
    // `HomeBarHost` draws exactly one `home-bar` div by construction (one slot, shared by every
    // claimant — see home-bar.tsx), so a `getAllByTestId("home-bar")` count can never tell a
    // single combined `<HomeBar left right>` apart from two separate `<HomeBar>` calls both
    // portaling into that one slot: round 1's actual bug (a second, host-mounted `HomeBarPortal`
    // beside this component's own) produced one `home-bar` div either way. What DID differ, and
    // is what broke the layout, is ORDER: the second portal's `right` (an `ml-auto` cluster)
    // mounted BEFORE this component's own `left`, which put the filter after an `ml-auto` and
    // flushed it right too. So the real guard is that `left` precedes `right` in the DOM — true
    // only when a single `<HomeBar left right>` call decides both slots at once, as `homeBarRight`
    // now guarantees by routing through here rather than a second portal.
    const field = screen.getByRole("searchbox");
    const hostAction = screen.getByRole("button", { name: "Host Action" });
    expect(strip).toContainElement(field);
    expect(strip).toContainElement(hostAction);
    expect(field.compareDocumentPosition(hostAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // homeBarRight also wins the right slot outright over newLabel's own button — see the
    // component's own comment on why passing both would ask for two create controls at once.
    expect(screen.queryByRole("button", { name: /New Project/ })).toBeNull();
  });

  // A host is most likely to reach `homeBarRight` naturally as `homeBarRight={condition &&
  // <X/>}`, which hands this `false` — not `undefined` — when `condition` is false. Before the
  // truthiness fix, `false != null` and `homeBarRight ?? …` both treat `false` as "given": the
  // gate publishes and `right` renders `false`, which `home-bar.tsx`'s `right !== undefined`
  // check still draws as an empty `ml-auto` div. With zero items (so `hasEntities` is also
  // false), the corrected code treats a falsy `homeBarRight` the same as an omitted one: no bar
  // at all, same as the "claims no bar at all with a loaded but empty list and no homeBarRight"
  // case above.
  it("does not publish an empty bar for a falsy homeBarRight", () => {
    renderExplorer({ items: [], homeBarRight: false });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });
});
