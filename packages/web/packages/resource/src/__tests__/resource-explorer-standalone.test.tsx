/// <reference types="@testing-library/jest-dom/vitest" />
//
// Standalone-mode exit-guard coverage for ResourceExplorer. On a feature site's /home there is
// NO rail host, so a topic pane's leaf-editor guard (registered via useRailExitGuard) must still
// reach an exit gate — ResourceExplorer provides its OWN rail host in that case. Before the fix the
// hooks no-op'd without a host and a dirty edit was discarded with no confirmation at all (the
// identical pane inside the hub shell does confirm). The confirmation is the one shared
// UnsavedChangesAlert (Discard / Stay — no Save, it never persists); Discard just lets the held
// clear proceed. Host mode is left untouched (it publishes into the external host and renders no
// HTD of its own).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { ResourceExplorer, type ResourceTopic } from "../resource-explorer";
import { useRailExitGuard, RailHostContext, type RailHostRegistry } from "../rail-host";

// ResourceExplorer uses next/navigation's useRouter internally. `push`/`replace` forward to
// whatever the current test wired up (see Harness below), so a guarded onClear() that actually
// fires is observable as a real prop change — not just a spy call that could pass even if the
// guarded action never ran.
let routeTo: ((href: string) => void) | null = null;
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => routeTo?.(href),
    replace: (href: string) => routeTo?.(href),
    prefetch: vi.fn(),
  }),
}));

// This package's vitest config has no global afterEach, so register cleanup explicitly.
afterEach(cleanup);

interface Row {
  id: string;
  name: string;
}
const ITEMS: Row[] = [{ id: "p1", name: "Project One" }];

/** A leaf-editor pane that registers an unsaved-work guard the way a real master/detail editor
 *  does. `dirty` is a prop so a test can flip it clean and prove the alert only guards a dirty
 *  pane. */
function DirtyEditorPane({ dirty }: { dirty: boolean }) {
  useRailExitGuard(dirty ? { isDirty: () => true } : null);
  return <div>editor pane</div>;
}

/** Owns the URL-driven `activeTopic` the way a real Next.js route would: a guarded onClear() that
 *  actually runs (Discard, or no guard at all) pushes "/home/p1" (no topic segment), which this
 *  harness reflects back as `activeTopic={undefined}` — so "editor pane" disappearing from the DOM
 *  is proof the level genuinely cleared, not an assumption about what a swallowed router.push
 *  "would have" done. */
function Harness({ dirty }: { dirty: boolean }) {
  const [activeTopic, setActiveTopic] = useState<string | undefined>("edit");
  routeTo = (href: string) => setActiveTopic(href.split("/")[3]); // "/home/p1" → undefined, "/home/p1/edit" → "edit"

  const topics: ResourceTopic[] = [
    {
      id: "edit",
      label: "Edit Topic",
      icon: null,
      render: () => <DirtyEditorPane dirty={dirty} />,
    },
  ];
  return (
    <ResourceExplorer<Row>
      activeId="p1"
      activeTopic={activeTopic}
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
    />
  );
}

describe("ResourceExplorer standalone exit guard", () => {
  it("raises Discard/Stay (never saves) when a dirty topic-pane guard is registered and the level is cleared", async () => {
    render(<Harness dirty />);

    // The editor pane mounted (and its guard registered) inside ResourceExplorer's own rail host.
    expect(await screen.findByText("editor pane")).toBeInTheDocument();

    // Re-clicking the SELECTED topic row would clear that level — with a dirty guard the package
    // must raise the shared Discard/Stay alert instead of clearing immediately.
    fireEvent.click(screen.getByText("Edit Topic"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Stay" })).toBeInTheDocument();

    // The alert never saves — Discard just lets the held clear proceed.
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard" }));

    // And the clear genuinely ran: the topic pane (and its guard) is gone.
    expect(screen.queryByText("editor pane")).not.toBeInTheDocument();
  });

  it("clears immediately with no alert when the topic pane is clean", async () => {
    render(<Harness dirty={false} />);

    expect(await screen.findByText("editor pane")).toBeInTheDocument();

    // The same re-click as above, but a clean pane registers no guard at all, so the level clears
    // with no prompt. This is the control for the test above: same gesture, same query, no dialog.
    fireEvent.click(screen.getByText("Edit Topic"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("editor pane")).not.toBeInTheDocument();
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
    // …and renders no exit-guard alert of its own (the external host owns the one HTD).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
