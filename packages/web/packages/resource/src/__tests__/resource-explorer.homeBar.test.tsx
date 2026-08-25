/// <reference types="@testing-library/jest-dom/vitest" />
//
// Pins Task 4: the resource rail's filter and its "New …" button move OUT of the rail header
// (`headerSlot`/`onNew` on the top-level `resourceLevel`) and into the home bar — the strip a
// `HomeBarHost` draws above the rails, shared by every site whose home feature runs through
// `ResourceExplorer`. Two tests carry most of the weight. The LAST one in the first describe block
// proves the field the bar renders is still the SAME `filter` state that narrows the rail's rows,
// i.e. that `HomeBarPortal` moved the control's DOM position without cutting it out of
// ResourceExplorer's React tree. The EMPTY-list one earlier in that block proves the create button
// survives a list with nothing in it, the regression the final review caught — see its own comment.
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
// describe block below exercises one of the three independent publish conditions: the bar must
// appear even with zero/unloaded items (a navigating host has no OTHER way to show its control),
// but the FILTER FIELD must not — there is nothing loaded to filter yet. The other two conditions
// are `hasEntities` (the field) and `canCreate` (the `newLabel` button), and the empty/loading
// tests in the first describe block are what pin `canCreate` being independent of `hasEntities`.
import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
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
  renderNewControl,
}: {
  items: Row[] | null;
  newLabel?: string;
  /** Exercises the `!promoteTopics` guard — see the last test below. */
  promoteTopics?: boolean;
  /** A host's own right-side control — see the `homeBarRight` describe block below. */
  homeBarRight?: ReactNode;
  /** The host's own SHAPE for the create trigger — see the `renderNewControl` block below. */
  renderNewControl?: (onNew: () => void) => ReactNode;
}) {
  // A HomeBarHost above the explorer, exactly like SiteHomeShell/WorkspaceShellInner mount in
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
        renderNewControl={renderNewControl}
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

  // THE REGRESSION CASE, and one of the two tests this file leans on hardest. An empty list is
  // precisely when a first create matters most — a brand-new tenant lands on `/home` with nothing
  // — and for one round of this branch the bar's only gate was `hasEntities` (`loaded &&
  // length > 0`), which meant that user got NO create affordance anywhere on the page:
  // `setNewOpen(true)` has exactly one call site, the button below (the component's other two
  // `setNewOpen` calls both CLOSE the dialog). `canCreate` (`!promoteTopics && newLabel != null`)
  // is what restores the pre-bar condition, and this test fails the moment someone folds it back
  // into `hasEntities`.
  //
  // Every assertion is scoped `within(strip)` on purpose. An unscoped `screen.getByRole` is
  // satisfied by `HomeBarPortal`'s no-host inline fallback, so it cannot tell a working publish
  // from a broken one — that exact vacuity shipped twice on this branch.
  it("publishes the bar with its New button, and no searchbox, on a loaded but EMPTY list", async () => {
    renderExplorer({ items: [], newLabel: "New Project…" });
    const strip = await screen.findByTestId("home-bar");
    // `newButtonLabel` strips the trailing ellipsis, so the rendered name is "New Project", not
    // "New Project…" — an exact-string query here also pins that stripping.
    expect(within(strip).getByRole("button", { name: "New Project" })).toBeInTheDocument();
    // The filter field is the one thing `hasEntities` still gates: an empty list has nothing to
    // filter, and the create button appearing must not drag it along.
    expect(within(strip).queryByRole("searchbox")).toBeNull();
  });

  // The same regression one beat earlier: `items === null` is how this component expresses "not
  // loaded" (`loaded = items !== null`, resource-explorer.tsx:235). Before the fix the create
  // button flickered in only once the list resolved; the pre-bar `resourceLevel.onNew` had no
  // `loaded` term at all, and a button that opens a dialog works perfectly well while the list
  // behind it is still arriving.
  it("publishes the bar with its New button, and no searchbox, while the list is still LOADING", async () => {
    renderExplorer({ items: null, newLabel: "New Project…" });
    const strip = await screen.findByTestId("home-bar");
    expect(within(strip).getByRole("button", { name: "New Project" })).toBeInTheDocument();
    expect(within(strip).queryByRole("searchbox")).toBeNull();
  });

  // The other side of the same coin, and the case this file used to cover here: with creation
  // SUPPRESSED (`newLabel` omitted) and no `homeBarRight`, none of the three publish conditions
  // holds, so there is no bar at all — not an empty one. Guards against a fix to the two tests
  // above that widened the gate to "always publish".
  it("claims no bar at all with a loaded but empty list, no newLabel and no homeBarRight", () => {
    renderExplorer({ items: [] });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  it("claims no bar at all before the list has loaded, with no newLabel and no homeBarRight", () => {
    renderExplorer({ items: null });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  // The `!promoteTopics` guard is the one piece of judgement in this change: `resourceLevel` (the
  // level the FILTER FIELD used to live on) is only ever spliced into `levels` when
  // `!promoteTopics`, so a promoteTopics host never rendered it before, however loaded/populated
  // `items` was — and EcosystemsFeature's own promoteTopics mount passes a `newLabel` with no
  // `renderDialog`, so a button that opened nothing is exactly what dropping this guard would have
  // shipped for the field/newLabel case this test covers.
  //
  // `!promoteTopics` is a term in BOTH conditions — `hasEntities` (the field) and `canCreate`
  // (the button) — and nothing else in this suite would notice either copy being deleted, so this
  // test asserts the button's absence explicitly and not just the bar's. It does NOT cover
  // `homeBarRight`, which carries no such term and bypasses both on purpose (see that prop's doc
  // in resource-explorer.tsx): a promoteTopics host passing `homeBarRight` DOES get a bar. This
  // render passes none, so the assertions below are about the field/newLabel half only.
  it("claims no bar and no create button in promoteTopics mode, even with items and a newLabel", () => {
    renderExplorer({
      promoteTopics: true,
      newLabel: "New Ecosystem…",
      items: [{ id: "a", label: "Alpha" }],
    });
    expect(screen.queryByTestId("home-bar")).toBeNull();
    // Unscoped deliberately, and the strictly stronger claim: with no bar there is nothing to
    // scope to, and dropping `!promoteTopics` from `canCreate` would publish this button — into
    // the strip if the host is above (as here), inline through `HomeBarPortal`'s fallback if not.
    // An unscoped query catches it either way.
    expect(screen.queryByRole("button", { name: "New Ecosystem" })).toBeNull();
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
    fireEvent.change(field, { target: { value: "Alph" } });
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
    // This render passes no `newLabel` either, so without `homeBarRight` it claims no bar at all
    // (see "claims no bar at all with a loaded but empty list, no newLabel and no homeBarRight"
    // above). With it, the bar must still appear: a host that creates by navigation, like games,
    // has no other way to show its control on an empty workspace.
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
  // <X/>}`, which hands this `false` — not `undefined` — when `condition` is false. With
  // `homeBarRight != null` and `??` the gate would publish and `right` would receive `false`,
  // i.e. a BAR with nothing in it. (`HomeBar` now skips a falsy slot, so the empty-SLOT half is
  // handled there for every caller — this test pins the half that is still this component's: not
  // publishing the bar at all.) With zero items and no `newLabel`, none of the three conditions
  // holds, so a falsy `homeBarRight` must behave exactly like an omitted one.
  it("does not publish an empty bar for a falsy homeBarRight", () => {
    renderExplorer({ items: [], homeBarRight: false });
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });
});

// `renderNewControl` is the OTHER half of the same seam: `homeBarRight` is for a host that owns
// the create MECHANISM, this is for a host that owns only its SHAPE. The registries feature is
// the first — its create verb lives behind a gear menu rather than as a standalone `+` button —
// and the distinction is worth pinning because the tempting way to build that gear is
// `homeBarRight`, which would have made the host re-implement the dialog, the reload and the
// route-to-the-new-row this component already does.
//
// It also renders somewhere else: the resource RAIL's own title row, not the home bar. That is
// the point of reaching for it — the bar is page chrome, shared with whatever the page nests
// inside this explorer, while a gear beside the rail's heading is attached to the list it creates
// into. So every assertion below is about the control being present and the bar NOT growing a
// second one.
describe("ResourceExplorer's renderNewControl — a host's own SHAPE for the create trigger", () => {
  it("renders the host's control outside the bar, and still opens the dialog", async () => {
    let opened = 0;
    renderExplorer({
      items: [{ id: "a", label: "Alpha" }],
      newLabel: "New Project…",
      renderNewControl: (onNew) => (
        <button
          type="button"
          onClick={() => {
            opened += 1;
            onNew();
          }}
        >
          Registry actions
        </button>
      ),
    });
    const strip = await screen.findByTestId("home-bar");
    const gear = screen.getByRole("button", { name: "Registry actions" });
    // Rendered, but NOT in the strip — it went to the rail's title row.
    expect(strip).not.toContainElement(gear);
    // The default button is REPLACED, not joined: one create affordance for the list, wherever
    // it sits. Without the `!renderNewControl` term the bar would still draw its own.
    expect(screen.queryByRole("button", { name: "New Project" })).toBeNull();
    fireEvent.click(gear);
    expect(opened).toBe(1);
  });

  // The bar's publish gate reads `createInBar`, not `canCreate` — otherwise a host whose only
  // bar-worthy content was the create button would publish an EMPTY strip above the rail once
  // that button moved out of it. With no entities there is nothing to filter either, so there is
  // nothing left for the bar to hold.
  it("does not publish a bar at all when the control is the only thing that would have been in it", () => {
    renderExplorer({
      items: [],
      newLabel: "New Project…",
      renderNewControl: () => <button type="button">Registry actions</button>,
    });
    expect(screen.getByRole("button", { name: "Registry actions" })).toBeInTheDocument();
    expect(screen.queryByTestId("home-bar")).toBeNull();
  });

  // Gated by `canCreate` exactly like the default button, so a host cannot publish a create
  // control where the explorer would refuse to render its own. promoteTopics is the sharper half:
  // that mode has no resource rail at all, so there is no title row to render into and the
  // promoted resource-list topic owns its own create.
  it("is gated by canCreate: no control in promoteTopics mode, and none without a newLabel", () => {
    renderExplorer({
      promoteTopics: true,
      newLabel: "New Ecosystem…",
      items: [{ id: "a", label: "Alpha" }],
      renderNewControl: () => <button type="button">Registry actions</button>,
    });
    expect(screen.queryByRole("button", { name: "Registry actions" })).toBeNull();
    cleanup();

    renderExplorer({
      items: [{ id: "a", label: "Alpha" }],
      renderNewControl: () => <button type="button">Registry actions</button>,
    });
    expect(screen.queryByRole("button", { name: "Registry actions" })).toBeNull();
  });

  // The two no longer compete for one slot, so the old precedence rule between them is gone: a
  // host may own a bar action AND the create shape, and gets both, in their two places.
  it("coexists with homeBarRight — they render in different places", async () => {
    renderExplorer({
      items: [{ id: "a", label: "Alpha" }],
      newLabel: "New Project…",
      homeBarRight: <button type="button">Host Action</button>,
      renderNewControl: () => <button type="button">Registry actions</button>,
    });
    const strip = await screen.findByTestId("home-bar");
    expect(strip).toContainElement(screen.getByRole("button", { name: "Host Action" }));
    const gear = screen.getByRole("button", { name: "Registry actions" });
    expect(strip).not.toContainElement(gear);
  });
});
