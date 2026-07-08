/// <reference types="@testing-library/jest-dom/vitest" />
//
// Standalone-mode exit-guard coverage for ResourceExplorer. On a feature site's /home there is
// NO rail host, so a topic pane's leaf-editor guard (registered via useRailExitGuard) must still
// reach an exit gate — ResourceExplorer provides its OWN rail host in that case. Before the fix the
// hooks no-op'd without a host and a dirty edit was discarded with no Save/Discard prompt (the
// identical pane inside the hub shell does prompt). Host mode is left untouched (it publishes into
// the external host and renders no HTD of its own).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ResourceExplorer, type ResourceTopic } from "../resource-explorer";
import { useRailExitGuard, RailHostContext, type RailHostRegistry } from "../rail-host";

// ResourceExplorer uses next/navigation's useRouter internally; selection is prop-driven here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// This package's vitest config has no global afterEach, so register cleanup explicitly.
afterEach(cleanup);

interface Row {
  id: string;
  name: string;
}
const ITEMS: Row[] = [{ id: "p1", name: "Project One" }];

/** A leaf-editor pane that is always dirty — it registers an unsaved-work guard the way a real
 *  master/detail editor does. `save` is spied so a test can prove the gate invoked it. */
function DirtyEditorPane({ save }: { save: () => Promise<boolean> }) {
  useRailExitGuard({ isDirty: () => true, save });
  return <div>editor pane</div>;
}

function renderStandalone(save: () => Promise<boolean>) {
  const topics: ResourceTopic[] = [
    {
      id: "edit",
      label: "Edit Topic",
      icon: null,
      render: () => <DirtyEditorPane save={save} />,
    },
  ];
  return render(
    <ResourceExplorer<Row>
      activeId="p1"
      activeTopic="edit"
      basePath="/home"
      items={ITEMS}
      getId={(i) => i.id}
      getLabel={(i) => i.name}
      nameSuffix="Project"
      topics={topics}
      newLabel="New"
      landing={{
        title: "All",
        help: "help",
        emptyLabel: "none",
        getSublabel: () => "",
        renderMeta: () => null,
      }}
    />,
  );
}

describe("ResourceExplorer standalone exit guard", () => {
  it("prompts (does not discard) when a dirty topic-pane guard is registered and the level is cleared", async () => {
    const save = vi.fn().mockResolvedValue(true);
    renderStandalone(save);

    // The editor pane mounted (and its guard registered) inside ResourceExplorer's own rail host.
    expect(await screen.findByText("editor pane")).toBeInTheDocument();

    // Re-clicking the SELECTED topic row would clear that level — with a dirty guard the package
    // must raise the Save/Discard/Cancel prompt instead of navigating away.
    fireEvent.click(screen.getByText("Edit Topic"));

    expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();

    // And Save routes through the registered guard.
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalled();
  });

  it("host mode is unchanged: it publishes into the external host and renders no HTD of its own", () => {
    const registerLevels = vi.fn();
    const host: RailHostRegistry = {
      registerLevels,
      unregisterLevels: vi.fn(),
      registerExitGuard: vi.fn(),
      toolbarSlot: null,
    };
    const topics: ResourceTopic[] = [
      { id: "edit", label: "Edit Topic", icon: null, render: () => <div>editor pane</div> },
    ];
    const Wrap = ({ children }: { children: ReactNode }) => (
      <RailHostContext.Provider value={host}>{children}</RailHostContext.Provider>
    );
    render(
      <Wrap>
        <ResourceExplorer<Row>
          activeId="p1"
          activeTopic="edit"
          basePath="/home"
          items={ITEMS}
          getId={(i) => i.id}
          getLabel={(i) => i.name}
          nameSuffix="Project"
          topics={topics}
          newLabel="New"
          landing={{ title: "All", help: "h", emptyLabel: "none", getSublabel: () => "", renderMeta: () => null }}
        />
      </Wrap>,
    );

    // It publishes its levels into the EXTERNAL host…
    expect(registerLevels).toHaveBeenCalled();
    // …and renders no exit-guard modal of its own (the external host owns the one HTD).
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });
});
