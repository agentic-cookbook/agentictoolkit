// @vitest-environment jsdom
//
// STANDALONE-mount test for the feature ENTRY: KnowledgeBasesFeature rendered with NO
// RailHostContext provider — the feature-site case. The pane publishes its tables rail
// via useStackLevel, which silently NO-OPS without a host; the entry's RailHostBoundary
// must therefore self-host (StandaloneRailHost) or the whole /home surface is a dead
// hint with no rail (the exact bug this branch's review found on four site mounts —
// every pre-existing test injected a host harness, which is how it shipped). This test
// deliberately injects NOTHING.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CrudTableMeta } from "@agentic-toolkit/crud";

// The chosen table's leaf renders CrudDataView (network-backed) — stub it; this test is
// about the RAIL existing at all, not the data view.
vi.mock("@agentic-toolkit/crud", async () => {
  const actual = await vi.importActual<typeof import("@agentic-toolkit/crud")>(
    "@agentic-toolkit/crud",
  );
  return {
    ...actual,
    CrudDataView: ({ meta }: { meta: CrudTableMeta }) => <div>crud:{meta.table}</div>,
  };
});

import { KnowledgeBasesFeature } from "./KnowledgeBasesFeature";

afterEach(cleanup);

const TABLES: CrudTableMeta[] = [
  {
    key: "persona-memory/blocks",
    schema: "persona-memory",
    table: "blocks",
    basePath: "/persona-memory/blocks",
    itemPath: "/persona-memory/blocks/{id}",
    pkParams: ["id"],
    columns: [],
  },
];

describe("KnowledgeBasesFeature standalone (no rail host)", () => {
  it("self-hosts the tables rail instead of silently no-opping", async () => {
    render(<KnowledgeBasesFeature basePath="/home" tables={TABLES} />);
    // The rail ROW for the table must exist — without RailHostBoundary the publisher
    // no-ops and only the "Select a table…" hint would render. The unselected frontier's
    // topic overview repeats the label as a card, so pin the match to the rail row.
    const labels = await screen.findAllByText("blocks");
    expect(labels.some((el) => el.closest("[data-htd-row]"))).toBe(true);
    expect(screen.getByText(/select a table/i)).toBeTruthy();
  });
});
