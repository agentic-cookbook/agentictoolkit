// @vitest-environment jsdom
//
// KnowledgeBasesFeature is a thin props seam over KnowledgeBasesPane (see KnowledgeBasesPane.test
// for the selection/guard/CrudDataView behavior this simply forwards into). This file only checks
// the seam itself: the host-supplied `tables` reach the pane, `basePath` is accepted without being
// required by the pane, and `scopeEcosystemId` threads through.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { CrudTableMeta } from "@agentic-toolkit/crud";

vi.mock("./KnowledgeBasesPane", () => ({
  KnowledgeBasesPane: ({
    tables,
    scopeEcosystemId,
  }: {
    tables: CrudTableMeta[];
    scopeEcosystemId?: string;
  }) => (
    <div>
      {tables.map((t) => t.table).join(",")}
      {scopeEcosystemId ? ` (scoped to ${scopeEcosystemId})` : ""}
    </div>
  ),
}));

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

describe("KnowledgeBasesFeature", () => {
  it("forwards the host-resolved tables to KnowledgeBasesPane", () => {
    render(<KnowledgeBasesFeature basePath="/w1/knowledgebases" tables={TABLES} />);
    expect(screen.getByText("blocks")).not.toBeNull();
  });

  it("forwards scopeEcosystemId to KnowledgeBasesPane", () => {
    render(
      <KnowledgeBasesFeature
        basePath="/w1/knowledgebases"
        tables={TABLES}
        scopeEcosystemId="eco1"
      />,
    );
    expect(screen.getByText("blocks (scoped to eco1)")).not.toBeNull();
  });
});
