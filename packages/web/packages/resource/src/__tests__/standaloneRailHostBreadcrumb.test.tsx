/// <reference types="@testing-library/jest-dom/vitest" />
//
// The breadcrumb bar on a bare feature site. Every home-route templated site mounts its feature
// through RailHostBoundary, which — with no hub shell above — becomes a StandaloneRailHost, and
// that host is the ONLY thing on those sites that mounts an HTD. It used to pass
// `showBreadcrumb={false}`, so the whole fleet's feature sites had no breadcrumb at all while the
// identical pane inside the hub had one.
//
// Turning the flag on is half the fix: the bar draws only when the trail is non-empty, and a
// standalone trail is empty until something is selected — a bar that appears on the first click
// and vanishes on Back is worse than no bar. So the host also supplies a ROOT crumb, taken from
// the first published level's own title, exactly as the hub's WorkspaceShell takes its root from
// its level 0. These tests pin all three: the bar exists unselected, the root crumb clears level
// 0, and an untitled feature still gets no blank bar.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import { RailHostBoundary, StandaloneRailHost } from "../standalone-rail-host";
import { RailHostContext, StackLevels, type RailHostRegistry } from "../rail-host";

// This package's vitest config has no global afterEach, so register cleanup explicitly.
afterEach(cleanup);

/** A feature entry's published rail, the way ResourceExplorer publishes its landing level: one
 *  level titled with the feature's landing label, whose `onClear` is that feature's own
 *  return-to-landing (a router.push in the real thing). */
function Feature({
  title = "All projects",
  selectedId = null,
  onClear = () => {},
}: {
  title?: string;
  selectedId?: string | null;
  onClear?: () => void;
}) {
  const level: TopicLevel = {
    id: "resource",
    title,
    items: [{ id: "p1", label: "Project One" }],
    selectedId,
    onSelect: () => {},
    onClear,
    emptyLabel: "none",
  };
  return (
    <StackLevels levels={[level]}>
      <div>leaf pane</div>
    </StackLevels>
  );
}

/** The bar itself — the one <nav aria-label="Breadcrumb"> the HTD's TopBar draws. */
const breadcrumb = () => screen.queryByRole("navigation", { name: "Breadcrumb" });

describe("StandaloneRailHost breadcrumb", () => {
  it("draws the bar with the feature's own landing title as the root crumb, with nothing selected", () => {
    render(
      <StandaloneRailHost>
        <Feature />
      </StandaloneRailHost>,
    );

    const nav = breadcrumb();
    expect(nav).toBeInTheDocument();
    // Nothing is selected, so the root IS the whole trail — which is precisely the case that
    // rendered no bar at all before the root crumb was supplied.
    expect(within(nav!).getByText("All projects")).toBeInTheDocument();
  });

  it("clears level 0 when the root crumb is clicked, once a selection has put a crumb after it", () => {
    const onClear = vi.fn();
    render(
      <StandaloneRailHost>
        <Feature selectedId="p1" onClear={onClear} />
      </StandaloneRailHost>,
    );

    // With a row selected the trail is root ▸ "Project One", so the root is no longer the last
    // crumb and renders as a button. (The last crumb is always static text — it is where you are.)
    const nav = breadcrumb()!;
    fireEvent.click(within(nav).getByRole("button", { name: "All projects" }));

    // `onNavigate(null)` runs `levels[0].onClear()` — the feature's return-to-landing, the same
    // gesture the hub's root crumb performs on its own level 0.
    expect(onClear).toHaveBeenCalled();
  });

  it("draws no bar for a feature that publishes no title — an empty root crumb would be a blank bar", () => {
    // ResourceExplorer's level 0 is titled `landing?.title ?? ""`, so an entry mounted without a
    // landing publishes an empty string. `rootLabel=""` is still a crumb as far as the HTD is
    // concerned, which is why the host maps it back to undefined rather than passing it through.
    render(
      <StandaloneRailHost>
        <Feature title="" />
      </StandaloneRailHost>,
    );

    expect(breadcrumb()).not.toBeInTheDocument();
  });
});

describe("RailHostBoundary breadcrumb", () => {
  it("gets the standalone bar when there is no host above", () => {
    render(
      <RailHostBoundary>
        <Feature />
      </RailHostBoundary>,
    );

    expect(breadcrumb()).toBeInTheDocument();
  });

  // The pass-through case: inside the hub's workspace chrome the boundary mounts no host and no
  // HTD of its own, so the breadcrumb stays the shell's ONE bar. A second one here would be a
  // nested trail inside the frontier pane — the same duplication the conditional exists to avoid.
  it("draws none of its own when a host already exists above (pass-through)", () => {
    const host: RailHostRegistry = {
      registerLevels: vi.fn(),
      unregisterLevels: vi.fn(),
      registerExitGuard: vi.fn(),
      popStack: vi.fn(),
      reportMissing: vi.fn(),
      reportBusy: vi.fn(),
      toolbarSlot: null,
    };
    render(
      <RailHostContext.Provider value={host}>
        <RailHostBoundary>
          <Feature />
        </RailHostBoundary>
      </RailHostContext.Provider>,
    );

    expect(breadcrumb()).not.toBeInTheDocument();
  });
});
