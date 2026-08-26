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
import type { TopicLevel } from "@agenticdevelopertoolkit/ui/blocks";
import type { CrudTableMeta } from "@agentic-toolkit/crud";

// The viewer behind the exposure gate. Hoisted so each test can set who is looking without
// standing up an AuthProvider; `readableTables` itself stays the REAL implementation, so these
// tests pin the pane's use of the gate, not a restatement of it.
const { viewerRef } = vi.hoisted(() => ({
  viewerRef: { current: { isAdmin: false, ready: true } },
}));

vi.mock("@agentic-toolkit/crud", async () => {
  const actual = await vi.importActual<typeof import("@agentic-toolkit/crud")>(
    "@agentic-toolkit/crud",
  );
  return {
    ...actual,
    useViewer: () => viewerRef.current,
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

afterEach(() => {
  cleanup();
  viewerRef.current = { isAdmin: false, ready: true };
});

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
 *  way the hub's workspace shell (or a standalone feature site's own rail) would. An empty level
 *  shows its `emptyLabel`, the way a real rail does, and stands in for the header spinner the real
 *  rail draws while `busy` — a typechecked optional prop cannot tell you whether this pane sets it. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  const level = levels[0];
  if (!level) return null;
  return (
    <div>
      {level.busy && <span data-testid={`busy-${level.id}`} />}
      {level.items.length === 0 && <p>{level.emptyLabel}</p>}
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
      popStack: () => {},
      reportMissing: () => {},
      reportBusy: () => {},
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

  // The exposure gate, which this pane applies because it publishes its own table list (the
  // /all-data browser filters the same way). Persona-memory is all `owner` today, so these use a
  // host that maps in a stricter table — exactly the case the gate exists for.
  describe("exposure", () => {
    const ADMIN_TABLE: CrudTableMeta = {
      key: "system/audit_events",
      schema: "system",
      table: "audit-events",
      basePath: "/system/audit-events",
      itemPath: "/system/audit-events/{id}",
      pkParams: ["id"],
      exposure: "admin",
      columns: [],
    };

    it("withholds a table the viewer may not read", () => {
      render(
        <Harness>
          <KnowledgeBasesPane tables={[...TABLES, ADMIN_TABLE]} />
        </Harness>,
      );
      expect(screen.queryByRole("button", { name: "audit-events" })).toBeNull();
      expect(screen.getByRole("button", { name: "blocks" })).not.toBeNull();
    });

    it("lists it for an admin", () => {
      viewerRef.current = { isAdmin: true, ready: true };
      render(
        <Harness>
          <KnowledgeBasesPane tables={[...TABLES, ADMIN_TABLE]} />
        </Harness>,
      );
      expect(screen.getByRole("button", { name: "audit-events" })).not.toBeNull();
    });

    it("publishes nothing until the viewer answer settles — 'Loading…', not 'No tables.'", () => {
      // Filtering on a not-yet-known admin bit would make an admin's table vanish and pop back.
      viewerRef.current = { isAdmin: false, ready: false };
      render(
        <Harness>
          <KnowledgeBasesPane tables={TABLES} />
        </Harness>,
      );
      expect(screen.queryByRole("button", { name: "blocks" })).toBeNull();
      expect(screen.getByText("Loading…")).not.toBeNull();
    });

    it("spins the list header while the viewer answer is outstanding, and stops when it lands", () => {
      // The spinner and the empty label answer two different questions about the same moment, and
      // only together do they read honestly: "Loading…" says why there are no rows, the spinner
      // says the column is still working. The viewer is the ONLY read behind this list — its rows
      // arrive as a prop — so it is also the only thing that can raise the flag.
      viewerRef.current = { isAdmin: false, ready: false };
      const { rerender } = render(
        <Harness>
          <KnowledgeBasesPane tables={TABLES} />
        </Harness>,
      );
      expect(screen.getByTestId("busy-knowledgebases-tables")).not.toBeNull();

      viewerRef.current = { isAdmin: false, ready: true };
      rerender(
        <Harness>
          <KnowledgeBasesPane tables={TABLES} />
        </Harness>,
      );
      // Cleared in the same paint that puts the rows up — a spinner still turning over a settled
      // list says a read is outstanding when none is.
      expect(screen.queryByTestId("busy-knowledgebases-tables")).toBeNull();
      expect(screen.getByRole("button", { name: "blocks" })).not.toBeNull();
    });
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
