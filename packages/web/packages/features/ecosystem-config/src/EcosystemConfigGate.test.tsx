// @vitest-environment jsdom
//
// THE TOPIC LIST SAYS WHEN THE GATE BELOW IT IS RESOLVING ITS SCOPE.
//
// Every pane in this package is scoped to the workspace's default ecosystem, and this gate is the
// one request that resolves it. Until the id lands, the pane below the gate is a shell with nothing
// to read against — a state the user waits through and the list used to keep to itself.
//
// The gate publishes NO level of its own: it is mounted below the list, one topic at a time. So it
// reports upward with `useReportBusy`, and the list it lights is whichever one is nearest above —
// which is why every case here renders it inside a published level rather than bare.
//
// The resolver is stubbed, because the half under test is the WIRING: which of its two in-flight
// flags reaches the topic list. `isPending` is false on every visit after the first (the resolution
// is cached), so a gate wired to it looks correct and reports nothing from the second visit on.
// That the resolver's `isFetching` really does stay true across a cached re-read is its own
// package's to prove, and does — data/src/ecosystems/__tests__/use-workspace-default-ecosystem.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

// The rail host's exit guard reaches for the App Router. Nothing here navigates.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const { useWorkspaceDefaultEcosystemId } = vi.hoisted(() => ({
  useWorkspaceDefaultEcosystemId: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/ecosystems", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/ecosystems")>()),
  useWorkspaceDefaultEcosystemId,
}));

import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import { RailHostBoundary, StackLevels } from "@agentic-toolkit/resource";
import { EcosystemConfigGate } from "./EcosystemConfigGate";

/** What the resolver hands back, one state at a time. `canManage` stays true throughout: a member
 *  who cannot manage gets a notice instead of the pane, which is a different test. */
function resolves(state: { ecosystemId?: string; isPending: boolean; isFetching: boolean }) {
  useWorkspaceDefaultEcosystemId.mockReturnValue({ canManage: true, isError: false, ...state });
}

/** The list the gate sits under — a topic list with the gated topic selected, the shape every
 *  caller of this gate renders (see OrganizationsFeature's Server bags / Tokens topics). */
const level: TopicLevel = {
  id: "org-topics",
  title: "Organization",
  items: [{ id: "server-bags", label: "Server bags" }],
  selectedId: "server-bags",
  onSelect: () => {},
  onClear: () => {},
};

function renderGate() {
  return render(
    <RailHostBoundary>
      <StackLevels levels={[level]}>
        <EcosystemConfigGate workspaceSlug="acme" feature="Server bags">
          {(ecosystemId) => <p>pane for {ecosystemId ?? "nothing"}</p>}
        </EcosystemConfigGate>
      </StackLevels>
    </RailHostBoundary>,
  );
}

const list = (): HTMLElement => screen.getByRole("complementary", { name: "Topic list" });
const spinner = (): HTMLElement | null =>
  within(list()).queryByRole("status", { name: "Loading" });

// This vitest config has no `globals: true` / auto-cleanup setup file, so each render must be
// torn down explicitly or the next test's queries see BOTH mounted trees.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the topic list above the gate reports its scope resolution", () => {
  it("spins in front of the title while the scope is still being resolved", () => {
    resolves({ isPending: true, isFetching: true });
    renderGate();

    // The rows are listed already — they are static — and the spinner is the only thing saying
    // the pane below them is not yet scoped to anything.
    expect(within(list()).getByText("Server bags")).not.toBeNull();
    expect(spinner()).not.toBeNull();
  });

  it("stops once the scope has landed", () => {
    resolves({ ecosystemId: "eco-1", isPending: false, isFetching: false });
    renderGate();

    expect(screen.getByText("pane for eco-1")).not.toBeNull();
    expect(spinner()).toBeNull();
  });

  it("spins again on a cached re-read, where nothing is pending", () => {
    // The second visit: the id is already known, so the gate paints its pane with no gap and
    // `isPending` is false — the re-read behind it is what the spinner is for.
    resolves({ ecosystemId: "eco-1", isPending: false, isFetching: true });
    renderGate();

    expect(spinner()).not.toBeNull();
  });
});
