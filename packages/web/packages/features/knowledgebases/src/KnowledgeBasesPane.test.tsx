// @vitest-environment jsdom
//
// Component test for KnowledgeBasesPane. This pane PUBLISHES the resolved tables as a rail level
// (via useStackLevel) rather than rendering the table list itself, so a tiny <Rail> harness backed
// by the toolkit's RailHostContext renders the published rows — the same path the hub's workspace
// shell (or a standalone feature site) would. CrudDataView is mocked (its own transport is tested
// in @agentic-toolkit/crud) so this file exercises only the pane's own selection + guard wiring and
// its use of the host-supplied `tables` prop, never a hub catalog.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";
import type { CrudTableMeta } from "@agentic-toolkit/crud";

vi.mock("@agentic-toolkit/crud", async () => {
  const actual = await vi.importActual<typeof import("@agentic-toolkit/crud")>(
    "@agentic-toolkit/crud",
  );
  return {
    ...actual,
    CrudDataView: ({
      meta,
      scopeEcosystemId,
    }: {
      meta: CrudTableMeta;
      scopeEcosystemId?: string;
    }) => (
      <div>
        Editing {meta.table}
        {scopeEcosystemId ? ` (scoped to ${scopeEcosystemId})` : ""}
      </div>
    ),
  };
});

import { KnowledgeBasesPane } from "./KnowledgeBasesPane";

afterEach(cleanup);

const TABLES: CrudTableMeta[] = [
  {
    key: "persona-memory/blocks",
    schema: "persona-memory",
    table: "blocks",
    basePath: "/persona-memory/blocks",
    itemPath: "/persona-memory/blocks/{id}",
    pkParams: ["id"],
    exposure: "owner",
    columns: [],
  },
  {
    key: "persona-memory/facts",
    schema: "persona-memory",
    table: "facts",
    basePath: "/persona-memory/facts",
    itemPath: "/persona-memory/facts/{id}",
    pkParams: ["id"],
    exposure: "owner",
    columns: [],
  },
];

/** Renders the published level's rows as clickable buttons — enough to drive table selection the
 *  way the hub's workspace shell (or a standalone feature site's own rail) would. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  const level = levels[0];
  if (!level) return null;
  return (
    <div>
      {level.items.map((it) => (
        <button key={it.id} type="button" onClick={() => level.onSelect(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** A minimal rail HOST: registers the pane's published level and exposes the merged stack the way
 *  a real host would (the host owns the merged view; this package owns only the RailHostContext
 *  contract). Stands in for the host so the published table list is drivable. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
  const registry: RailHostRegistry = useMemo(
    () => ({
      registerLevels: (id, entry) =>
        setEntries((m) => {
          const next = new Map(m);
          next.set(id, entry);
          return next;
        }),
      unregisterLevels: (id) =>
        setEntries((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: () => {},
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <Rail levels={mergedLevels} />
      {children}
    </RailHostContext.Provider>
  );
}

describe("KnowledgeBasesPane", () => {
  it("shows a placeholder until a table is selected", () => {
    render(
      <Harness>
        <KnowledgeBasesPane tables={TABLES} />
      </Harness>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Select a table to view its data.");
  });

  it("publishes the host-supplied tables (not a catalog of its own) as the rail level", () => {
    render(
      <Harness>
        <KnowledgeBasesPane tables={TABLES} />
      </Harness>,
    );
    expect(screen.getByRole("button", { name: "blocks" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "facts" })).not.toBeNull();
  });

  it("opens the selected table's CrudDataView", () => {
    render(
      <Harness>
        <KnowledgeBasesPane tables={TABLES} />
      </Harness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "facts" }));
    expect(screen.getByText(/^Editing facts/)).not.toBeNull();
  });

  it("threads scopeEcosystemId through to CrudDataView (the persona editor's Knowledge facet)", () => {
    render(
      <Harness>
        <KnowledgeBasesPane tables={TABLES} scopeEcosystemId="eco1" />
      </Harness>,
    );
    fireEvent.click(screen.getByRole("button", { name: "blocks" }));
    expect(screen.getByText("Editing blocks (scoped to eco1)")).not.toBeNull();
  });
});
